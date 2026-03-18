import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { isAddress } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';
import { randomBytes } from 'crypto';

interface SecretEntry {
  secret: string;
  publicAddresses: string[];
}

interface SecretData {
  [slot: string]: SecretEntry;
}

/**
 * Secret service for storing and accessing secrets with owner-based access control.
 */
@Injectable()
export class SecretService {
  private readonly secretPath: string;

  constructor() {
    this.secretPath = path.join(process.cwd(), 'chest.json');
  }

  /**
   * Stores a secret and returns a unique slot identifier.
   * @param secret The secret to store
   * @param publicAddresses Array of Ethereum addresses that can access this secret
   * @returns The slot identifier
   * @throws BadRequestException if addresses are invalid
   */
  async store(secret: string, publicAddresses: string[]): Promise<string> {
    // Validate input
    if (!secret || secret.trim().length === 0) {
      throw new BadRequestException('Secret cannot be empty');
    }

    if (!publicAddresses || publicAddresses.length === 0) {
      throw new BadRequestException(
        'At least one public address must be provided',
      );
    }

    // Validate all addresses
    for (const address of publicAddresses) {
      if (!isAddress(address)) {
        throw new BadRequestException(
          `Invalid Ethereum address: ${String(address)}`,
        );
      }
    }

    // Normalize addresses to checksummed format
    const normalizedAddresses = publicAddresses.map((addr) =>
      addr.toLowerCase(),
    );

    // Generate unique slot
    const slot = this.generateSlot();

    // Load existing secret data
    const secretData = await this.loadSecret();

    // Store the entry
    secretData[slot] = {
      secret,
      publicAddresses: normalizedAddresses,
    };

    // Save to file
    await this.saveSecret(secretData);

    return slot;
  }

  /**
   * Accesses a secret if the caller is an owner.
   * @param slot The slot identifier
   * @param callerAddress The address of the caller (from SIWE authentication)
   * @returns The secret
   * @throws NotFoundException if slot doesn't exist
   * @throws ForbiddenException if caller is not an owner
   */
  async access(slot: string, callerAddress: string): Promise<string> {
    if (!slot || slot.trim().length === 0) {
      throw new BadRequestException('Slot cannot be empty');
    }

    if (!callerAddress || !isAddress(callerAddress)) {
      throw new BadRequestException('Invalid caller address');
    }

    // Load secret data
    const secretData = await this.loadSecret();

    // Check if slot exists
    const entry = secretData[slot];
    if (!entry) {
      throw new NotFoundException(`Slot not found: ${slot}`);
    }

    // Normalize caller address for comparison
    const normalizedCaller = callerAddress.toLowerCase();

    // Check if caller is an owner
    if (!entry.publicAddresses.includes(normalizedCaller)) {
      throw new ForbiddenException(
        'Access denied: caller is not an owner of this secret',
      );
    }

    return entry.secret;
  }

  /**
   * Generates a unique slot identifier.
   * @returns A random hex string
   */
  private generateSlot(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Loads the secret data from the JSON file.
   * @returns The secret data object
   */
  private async loadSecret(): Promise<SecretData> {
    try {
      if (!fs.existsSync(this.secretPath)) {
        return {};
      }

      const data = await fs.promises.readFile(this.secretPath, 'utf-8');
      return JSON.parse(data) as SecretData;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return {};
      }
      throw new Error(
        `Failed to load secret: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { cause: error },
      );
    }
  }

  /**
   * Saves the secret data to the JSON file.
   * @param data The secret data to save
   */
  private async saveSecret(data: SecretData): Promise<void> {
    try {
      await fs.promises.writeFile(
        this.secretPath,
        JSON.stringify(data, null, 2),
        'utf-8',
      );
    } catch (error) {
      throw new Error(
        `Failed to save secret: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { cause: error },
      );
    }
  }
}
