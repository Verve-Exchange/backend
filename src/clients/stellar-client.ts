import {
  Contract,
  Keypair,
  TransactionBuilder,
  BASE_FEE,
  nativeToScVal,
  rpc,
} from '@stellar/stellar-sdk';
import { logger } from '../utils/logger';
import { RelayerConfig } from '../config';
import {
  StellarConnectionError,
  TransactionSimulationError,
  TransactionSubmissionError,
  TimeoutError,
} from '../utils/errors';

export class StellarClient {
  private server: rpc.Server;
  private keypair: Keypair;
  private networkPassphrase: string;
  private receiverContract: Contract;

  constructor(config: RelayerConfig) {
    this.server = new rpc.Server(config.stellar.rpcUrl);
    this.keypair = Keypair.fromSecret(config.relayer.secretKey);
    this.networkPassphrase = config.stellar.networkPassphrase;
    this.receiverContract = new Contract(config.pyth.oracleContractId);

    logger.info(
      {
        publicKey: this.keypair.publicKey(),
        network: config.stellar.network,
        oracleContract: config.pyth.oracleContractId,
      },
      'Stellar client initialized'
    );
  }

  /**
   * Submit price update to Oracle Manager contract
   */
  async submitPriceUpdate(
    asset: string,
    price: string,
    confidence: number,
    expo: number
  ): Promise<string> {
    try {
      // Get account
      const account = await this.server.getAccount(this.keypair.publicKey());

      // Convert parameters to ScVal
      const assetScVal = nativeToScVal(asset, { type: 'symbol' });
      const priceScVal = nativeToScVal(BigInt(price), { type: 'i128' });
      const confidenceScVal = nativeToScVal(confidence, { type: 'u32' });
      const expoScVal = nativeToScVal(expo, { type: 'i32' });

      // Build transaction
      const operation = this.receiverContract.call(
        'update_price',
        assetScVal,
        priceScVal,
        confidenceScVal,
        expoScVal
      );

      const transaction = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(operation)
        .setTimeout(30)
        .build();

      // Simulate transaction
      const simulated = await this.server.simulateTransaction(transaction);

      if (rpc.Api.isSimulationError(simulated)) {
        throw new TransactionSimulationError(JSON.stringify(simulated));
      }

      // Prepare transaction with simulation results
      const prepared = rpc.assembleTransaction(transaction, simulated).build();

      // Sign transaction
      prepared.sign(this.keypair);

      // Submit transaction
      const response = await this.server.sendTransaction(prepared);

      if (response.status === 'ERROR') {
        throw new TransactionSubmissionError(JSON.stringify(response));
      }

      logger.debug({ hash: response.hash }, 'Transaction submitted');

      // Wait for confirmation
      const result = await this.waitForTransaction(response.hash);

      if (result.status !== 'SUCCESS') {
        throw new TransactionSubmissionError(`Transaction status: ${result.status}`);
      }

      return response.hash;
    } catch (error) {
      logger.error({ error, asset }, 'Failed to submit price update');
      
      if (error instanceof TransactionSimulationError || error instanceof TransactionSubmissionError) {
        throw error;
      }
      
      throw new StellarConnectionError(
        error instanceof Error ? error.message : 'Unknown error submitting transaction'
      );
    }
  }

  /**
   * Wait for transaction confirmation
   */
  private async waitForTransaction(
    hash: string,
    maxAttempts: number = 30
  ): Promise<rpc.Api.GetTransactionResponse> {
    let attempts = 0;

    while (attempts < maxAttempts) {
      const result = await this.server.getTransaction(hash);

      if (result.status !== 'NOT_FOUND') {
        return result;
      }

      await this.sleep(1000);
      attempts++;
    }

    throw new TimeoutError(`Transaction ${hash}`, maxAttempts * 1000);
  }

  /**
   * Get account balance
   */
  async getBalance(): Promise<string> {
    try {
      await this.server.getAccount(this.keypair.publicKey());
      // RPC Server's getAccount returns a basic Account object
      // To get balance, you'd need to query Horizon or use getLedgerEntries
      return '0'; // Placeholder - implement proper balance fetching if needed
    } catch (error) {
      logger.error({ error }, 'Failed to get account info');
      return '0';
    }
  }

  /**
   * Check if account exists and is funded
   */
  async isAccountFunded(): Promise<boolean> {
    try {
      await this.server.getAccount(this.keypair.publicKey());
      return true;
    } catch (error) {
      logger.warn({ publicKey: this.keypair.publicKey() }, 'Account not found or not funded');
      return false;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
