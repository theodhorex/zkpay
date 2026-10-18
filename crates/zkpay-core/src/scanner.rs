use prost::Message;
use serde::{Deserialize, Serialize};
use zcash_client_backend::proto::compact_formats::CompactBlock;
use zcash_keys::keys::UnifiedFullViewingKey;
use zcash_protocol::consensus::Network;

use orchard::keys::PreparedIncomingViewingKey as PreparedOrchardIvk;
use orchard::note::ExtractedNoteCommitment as OrchardExtractedCommitment;
use orchard::note::Nullifier as OrchardNullifier;
use orchard::note_encryption::{CompactAction, OrchardDomain};
use zcash_note_encryption::EphemeralKeyBytes;

use sapling_crypto::keys::PreparedIncomingViewingKey as PreparedSaplingIvk;
use sapling_crypto::note::ExtractedNoteCommitment as SaplingExtractedCommitment;
use sapling_crypto::note_encryption::{
    try_sapling_compact_note_decryption, CompactOutputDescription, Zip212Enforcement,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedPayment {
    pub txid: String,
    pub pool: String,
    pub value_zatoshis: u64,
    pub value_zec: f64,
    pub diversifier: String,
    pub recipient_address: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub success: bool,
    pub block_height: u64,
    pub block_hash: String,
    pub payments_found: Vec<DetectedPayment>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

pub fn scan_compact_block_bytes(
    network: &Network,
    ufvk: &UnifiedFullViewingKey,
    raw_block_bytes: &[u8],
) -> Result<ScanResult, String> {
    let block = CompactBlock::decode(raw_block_bytes)
        .map_err(|e| format!("Protobuf decode error for CompactBlock: {:?}", e))?;

    scan_compact_block(network, ufvk, &block)
}

pub fn scan_compact_block(
    network: &Network,
    ufvk: &UnifiedFullViewingKey,
    block: &CompactBlock,
) -> Result<ScanResult, String> {
    let mut payments = Vec::new();

    let prepared_orchard_ivk = ufvk
        .orchard()
        .map(|fvk| PreparedOrchardIvk::new(&fvk.to_ivk(zip32::Scope::External)));

    let prepared_sapling_ivk = ufvk
        .sapling()
        .map(|fvk| PreparedSaplingIvk::new(&fvk.to_ivk(zip32::Scope::External)));

    for tx in &block.vtx {
        let mut txid_display = tx.txid.clone();
        txid_display.reverse();
        let txid_hex = hex::encode(&txid_display);

        // 1. Scan Orchard Actions
        if let Some(ref ivk) = prepared_orchard_ivk {
            for action in &tx.actions {
                if action.nullifier.len() == 32
                    && action.cmx.len() == 32
                    && action.ephemeral_key.len() == 32
                    && action.ciphertext.len() == 52
                {
                    let nf_bytes: [u8; 32] = action.nullifier.as_slice().try_into().unwrap();
                    let cmx_bytes: [u8; 32] = action.cmx.as_slice().try_into().unwrap();
                    let epk_bytes: [u8; 32] = action.ephemeral_key.as_slice().try_into().unwrap();
                    let enc_ciphertext: [u8; 52] = action.ciphertext.as_slice().try_into().unwrap();

                    let nf = Option::from(OrchardNullifier::from_bytes(&nf_bytes));
                    let cmx = Option::from(OrchardExtractedCommitment::from_bytes(&cmx_bytes));
                    let epk = EphemeralKeyBytes(epk_bytes);

                    if let (Some(nf), Some(cmx)) = (nf, cmx) {
                        let compact_action =
                            CompactAction::from_parts(nf, cmx, epk, enc_ciphertext);
                        let domain = OrchardDomain::for_compact_action(&compact_action);
                        if let Some((note, recipient)) =
                            zcash_note_encryption::try_compact_note_decryption(
                                &domain,
                                ivk,
                                &compact_action,
                            )
                        {
                            let zatoshis = note.value().inner();
                            let diversifier_hex = hex::encode(recipient.diversifier().as_array());
                            let ua = zcash_keys::address::UnifiedAddress::from_receivers(
                                Some(recipient),
                                None,
                                None,
                            )
                            .map(|u| u.encode(network));

                            payments.push(DetectedPayment {
                                txid: txid_hex.clone(),
                                pool: "orchard".to_string(),
                                value_zatoshis: zatoshis,
                                value_zec: zatoshis as f64 / 100_000_000.0,
                                diversifier: diversifier_hex,
                                recipient_address: ua,
                            });
                        }
                    }
                }
            }
        }

        // 2. Scan Sapling Outputs
        if let Some(ref ivk) = prepared_sapling_ivk {
            for output in &tx.outputs {
                if output.cmu.len() == 32
                    && output.ephemeral_key.len() == 32
                    && output.ciphertext.len() == 52
                {
                    let cmu_bytes: [u8; 32] = output.cmu.as_slice().try_into().unwrap();
                    let epk_bytes: [u8; 32] = output.ephemeral_key.as_slice().try_into().unwrap();
                    let enc_ciphertext: [u8; 52] = output.ciphertext.as_slice().try_into().unwrap();

                    let cmu_opt = Option::from(SaplingExtractedCommitment::from_bytes(&cmu_bytes));
                    if let Some(cmu) = cmu_opt {
                        let compact_output = CompactOutputDescription {
                            cmu,
                            ephemeral_key: EphemeralKeyBytes(epk_bytes),
                            enc_ciphertext,
                        };

                        let decrypted = try_sapling_compact_note_decryption(
                            ivk,
                            &compact_output,
                            Zip212Enforcement::On,
                        )
                        .or_else(|| {
                            try_sapling_compact_note_decryption(
                                ivk,
                                &compact_output,
                                Zip212Enforcement::Off,
                            )
                        });

                        if let Some((note, recipient)) = decrypted {
                            let zatoshis = note.value().inner();
                            let diversifier_hex = hex::encode(recipient.diversifier().0);
                            let ua = zcash_keys::address::UnifiedAddress::from_receivers(
                                None,
                                Some(recipient),
                                None,
                            )
                            .map(|u| u.encode(network));

                            payments.push(DetectedPayment {
                                txid: txid_hex.clone(),
                                pool: "sapling".to_string(),
                                value_zatoshis: zatoshis,
                                value_zec: zatoshis as f64 / 100_000_000.0,
                                diversifier: diversifier_hex,
                                recipient_address: ua,
                            });
                        }
                    }
                }
            }
        }
    }

    let mut block_hash_display = block.hash.clone();
    block_hash_display.reverse();

    Ok(ScanResult {
        success: true,
        block_height: block.height,
        block_hash: hex::encode(block_hash_display),
        payments_found: payments,
        error: None,
    })
}
