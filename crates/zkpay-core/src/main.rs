use clap::{Parser, Subcommand};
use serde::{Deserialize, Serialize};
use std::process;
use zip32::{AccountId, DiversifierIndex};
use zcash_address::unified::{Encoding, Ufvk};
use zcash_keys::keys::{UnifiedAddressRequest, UnifiedFullViewingKey, UnifiedSpendingKey};
use zcash_protocol::consensus::{Network, NetworkType};

#[derive(Parser)]
#[command(name = "zkpay-core")]
#[command(about = "Zcash cryptographic core engine for zkpay", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Validate a Unified Full Viewing Key (UFVK) string
    ValidateUfvk {
        #[arg(long)]
        ufvk: String,
    },
    /// Derive a diversified unified address from a UFVK for a specific invoice index
    DeriveAddress {
        #[arg(long)]
        ufvk: String,
        #[arg(long)]
        index: u32,
    },
    /// Generate a fresh testnet keypair and UFVK for testing/development
    GenerateTestAccount {
        #[arg(long, default_value_t = 0)]
        seed_nonce: u8,
    },
}

#[derive(Serialize, Deserialize)]
struct ValidateUfvkResponse {
    success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    network: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    has_orchard: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    has_sapling: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct DeriveAddressResponse {
    success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    network: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    address: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    diversifier_index: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    has_orchard: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    has_sapling: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct GenerateTestAccountResponse {
    success: bool,
    network: String,
    ufvk: String,
    default_address: String,
}


fn parse_ufvk(ufvk_str: &str) -> Result<(Network, UnifiedFullViewingKey), String> {
    let (net_type, ufvk_raw) = Ufvk::decode(ufvk_str)
        .map_err(|e| format!("Invalid UFVK bech32m encoding: {:?}", e))?;

    let network = match net_type {
        NetworkType::Main => Network::MainNetwork,
        NetworkType::Test => Network::TestNetwork,
        _ => return Err("Unsupported network type".to_string()),
    };

    let ufvk = UnifiedFullViewingKey::parse(&ufvk_raw)
        .map_err(|e| format!("Failed to parse UFVK keys: {:?}", e))?;

    Ok((network, ufvk))
}

fn network_name(network: &Network) -> &'static str {
    match network {
        Network::MainNetwork => "mainnet",
        Network::TestNetwork => "testnet",
    }
}

fn main() {
    let cli = Cli::parse();

    match cli.command {
        Commands::ValidateUfvk { ufvk } => {
            match parse_ufvk(&ufvk) {
                Ok((network, ufvk)) => {
                    let resp = ValidateUfvkResponse {
                        success: true,
                        network: Some(network_name(&network).to_string()),
                        has_orchard: Some(ufvk.orchard().is_some()),
                        has_sapling: Some(ufvk.sapling().is_some()),
                        error: None,
                    };
                    println!("{}", serde_json::to_string_pretty(&resp).unwrap());
                }
                Err(err) => {
                    let resp = ValidateUfvkResponse {
                        success: false,
                        network: None,
                        has_orchard: None,
                        has_sapling: None,
                        error: Some(err),
                    };
                    println!("{}", serde_json::to_string_pretty(&resp).unwrap());
                    process::exit(1);
                }
            }
        }
        Commands::DeriveAddress { ufvk, index } => {
            match parse_ufvk(&ufvk) {
                Ok((network, ufvk)) => {
                    let j = DiversifierIndex::from(index);
                    match ufvk.find_address(j, UnifiedAddressRequest::SHIELDED) {
                        Ok((ua, _actual_j)) => {
                            let encoded_addr = ua.encode(&network);
                            let resp = DeriveAddressResponse {
                                success: true,
                                network: Some(network_name(&network).to_string()),
                                address: Some(encoded_addr),
                                diversifier_index: Some(index),
                                has_orchard: Some(ua.has_orchard()),
                                has_sapling: Some(ua.has_sapling()),
                                error: None,
                            };
                            println!("{}", serde_json::to_string_pretty(&resp).unwrap());
                        }
                        Err(e) => {
                            let resp = DeriveAddressResponse {
                                success: false,
                                network: Some(network_name(&network).to_string()),
                                address: None,
                                diversifier_index: None,
                                has_orchard: None,
                                has_sapling: None,
                                error: Some(format!("Address derivation error: {:?}", e)),
                            };
                            println!("{}", serde_json::to_string_pretty(&resp).unwrap());
                            process::exit(1);
                        }
                    }
                }
                Err(err) => {
                    let resp = DeriveAddressResponse {
                        success: false,
                        network: None,
                        address: None,
                        diversifier_index: None,
                        has_orchard: None,
                        has_sapling: None,
                        error: Some(err),
                    };
                    println!("{}", serde_json::to_string_pretty(&resp).unwrap());
                    process::exit(1);
                }
            }
        }
        Commands::GenerateTestAccount { seed_nonce } => {
            let network = Network::TestNetwork;
            let mut seed = [0u8; 32];
            seed[0] = seed_nonce;
            seed[31] = 0x7a; // 'z'
            let usk = UnifiedSpendingKey::from_seed(&network, &seed, AccountId::ZERO)
                .expect("Valid test seed");
            let ufvk = usk.to_unified_full_viewing_key();
            let ufvk_str = ufvk.encode(&network);
            let (ua, _) = ufvk
                .find_address(DiversifierIndex::from(0u32), UnifiedAddressRequest::SHIELDED)
                .expect("Derivation of default address");
            let default_addr = ua.encode(&network);

            let resp = GenerateTestAccountResponse {
                success: true,
                network: "testnet".to_string(),
                ufvk: ufvk_str,
                default_address: default_addr,
            };
            println!("{}", serde_json::to_string_pretty(&resp).unwrap());
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use zip32::AccountId;
    use zcash_keys::keys::UnifiedSpendingKey;

    #[test]
    fn test_ufvk_derivation_determinism_and_distinctness() {
        let network = Network::TestNetwork;
        let seed = [99u8; 32];
        let usk = UnifiedSpendingKey::from_seed(&network, &seed, AccountId::ZERO).unwrap();
        let ufvk = usk.to_unified_full_viewing_key();
        let ufvk_str = ufvk.encode(&network);
        assert!(ufvk_str.starts_with("uviewtest1"), "Testnet UFVK must start with uviewtest1");

        // Parse UFVK from string
        let (parsed_net, parsed_ufvk) = parse_ufvk(&ufvk_str).expect("Valid UFVK must parse");
        assert_eq!(network_name(&parsed_net), "testnet");
        assert!(parsed_ufvk.orchard().is_some());
        assert!(parsed_ufvk.sapling().is_some());

        // Derive address for index 1
        let (ua1, _) = parsed_ufvk.find_address(DiversifierIndex::from(1u32), UnifiedAddressRequest::SHIELDED).unwrap();
        let addr1 = ua1.encode(&network);
        assert!(addr1.starts_with("utest1"), "Address must start with utest1");

        // Derive address for index 2
        let (ua2, _) = parsed_ufvk.find_address(DiversifierIndex::from(2u32), UnifiedAddressRequest::SHIELDED).unwrap();
        let addr2 = ua2.encode(&network);
        assert!(addr2.starts_with("utest1"), "Address must start with utest1");

        // Determinism test: index 1 again must match addr1
        let (ua1_repeat, _) = parsed_ufvk.find_address(DiversifierIndex::from(1u32), UnifiedAddressRequest::SHIELDED).unwrap();
        let addr1_repeat = ua1_repeat.encode(&network);
        assert_eq!(addr1, addr1_repeat, "Derivation at same index must be deterministic");

        // Distinctness test: index 1 != index 2
        assert_ne!(addr1, addr2, "Different indices must yield distinct addresses");
    }

    #[test]
    fn test_invalid_ufvk_rejection() {
        assert!(parse_ufvk("invalid_ufvk_string").is_err());
        assert!(parse_ufvk("").is_err());
        assert!(parse_ufvk("uviewtest1notavalidkey000").is_err());
    }
}

