declare global {
  namespace App {
    interface Locals {
      /** The signed-in member's DID, if any. */
      viewer: string | null;
    }
    interface Error {
      message: string;
    }
  }
}

export {};
