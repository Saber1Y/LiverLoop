declare module "dkg.js" {
  type DkgContent = {
    public?: Record<string, unknown>;
    private?: Record<string, unknown>;
  };

  type DkgOptions = {
    epochsNum?: number;
    minimumNumberOfFinalizationConfirmations?: number;
    minimumNumberOfNodeReplications?: number;
    contentType?: "public" | "private" | "all";
  };

  export default class DKG {
    constructor(config: Record<string, unknown>);
    node: {
      info(): Promise<Record<string, unknown>>;
    };
    asset: {
      create(content: DkgContent, options?: DkgOptions): Promise<{
        UAL?: string;
        datasetRoot?: string;
        operation?: Record<string, unknown>;
      }>;
      get(ual: string, options?: { contentType?: string }): Promise<Record<string, unknown>>;
    };
    graph: {
      query(query: string, queryType?: string): Promise<unknown>;
    };
  }
}

declare module "dkg.js/constants/constants.js" {
  export const BLOCKCHAIN_IDS: {
    BASE_TESTNET: string;
    BASE_MAINNET: string;
    GNOSIS_TESTNET: string;
    NEUROWEB_TESTNET: string;
  };
}
