import path from "node:path";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";

export interface LightdInfo {
  version: string;
  vendor: string;
  taddrSupport: boolean;
  chainName: string;
  saplingActivationHeight: number;
  consensusBranchId: string;
  blockHeight: number;
}

export interface CompactOutput {
  cmu: Buffer;
  ephemeralKey: Buffer;
  ciphertext: Buffer;
}

export interface CompactAction {
  nullifier: Buffer;
  cmx: Buffer;
  ephemeralKey: Buffer;
  encCiphertext: Buffer;
}

export interface CompactTx {
  index: number;
  hash: Buffer;
  fee: number;
  spends: Array<{ nfname: Buffer }>;
  outputs: CompactOutput[];
  actions: CompactAction[];
}

export interface CompactBlock {
  protoVersion: number;
  height: number;
  hash: Buffer;
  prevHash: Buffer;
  time: number;
  header: Buffer;
  vtx: CompactTx[];
}

export class LightwalletdClient {
  private client: any;
  private endpoint: string;

  constructor(endpointOrOptions?: string | { endpoint?: string; useTls?: boolean }) {
    if (typeof endpointOrOptions === "object" && endpointOrOptions !== null) {
      this.endpoint = endpointOrOptions.endpoint || process.env.ZCASH_LIGHTWALLETD_URL || "testnet.zec.rocks:443";
    } else {
      this.endpoint = endpointOrOptions || process.env.ZCASH_LIGHTWALLETD_URL || "testnet.zec.rocks:443";
    }

    const packageDefinition = protoLoader.loadSync(
      path.resolve(process.cwd(), "proto/service.proto"),
      {
        keepCase: false,
        longs: Number,
        enums: String,
        defaults: true,
        oneofs: true,
        includeDirs: [path.resolve(process.cwd(), "proto")],
      }
    );

    const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any;
    const Service = protoDescriptor.cash.z.wallet.sdk.rpc.CompactTxStreamer;

    // Use secure SSL credentials for port 443, insecure for other ports
    const credentials = this.endpoint.endsWith(":443")
      ? grpc.credentials.createSsl()
      : grpc.credentials.createInsecure();

    this.client = new Service(this.endpoint, credentials);
  }

  getEndpoint(): string {
    return this.endpoint;
  }

  /**
   * Returns metadata and current block height of the lightwalletd node.
   */
  async getLightdInfo(): Promise<LightdInfo> {
    return new Promise((resolve, reject) => {
      this.client.getLightdInfo({}, (err: any, response: any) => {
        if (err) return reject(err);
        resolve({
          version: response.version,
          vendor: response.vendor,
          taddrSupport: response.taddrSupport,
          chainName: response.chainName,
          saplingActivationHeight: Number(response.saplingActivationHeight),
          consensusBranchId: response.consensusBranchId,
          blockHeight: Number(response.blockHeight),
        });
      });
    });
  }

  /**
   * Returns latest block height reported by lightwalletd.
   */
  async getLatestBlockHeight(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.client.getLatestBlock({}, (err: any, response: any) => {
        if (err) return reject(err);
        resolve(Number(response.height));
      });
    });
  }

  /**
   * Fetches a single compact block at the specified height.
   */
  async getBlock(height: number): Promise<CompactBlock> {
    return new Promise((resolve, reject) => {
      this.client.getBlock({ height }, (err: any, response: any) => {
        if (err) return reject(err);
        resolve(response as CompactBlock);
      });
    });
  }

  /**
   * Fetches a batch of compact blocks from startHeight to endHeight (inclusive).
   */
  async getBlockRange(startHeight: number, endHeight: number): Promise<CompactBlock[]> {
    return new Promise((resolve, reject) => {
      const stream = this.client.getBlockRange({
        start: { height: startHeight },
        end: { height: endHeight },
      });

      const blocks: CompactBlock[] = [];

      stream.on("data", (block: CompactBlock) => {
        blocks.push(block);
      });

      stream.on("end", () => {
        resolve(blocks);
      });

      stream.on("error", (err: any) => {
        reject(err);
      });
    });
  }

  close(): void {
    if (this.client) {
      this.client.close();
    }
  }
}
