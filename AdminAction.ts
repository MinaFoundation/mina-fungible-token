import { Field, Struct } from "o1js"

/** Enumerates the different types of administrative actions that can be performed on a token. */
export class AdminAction extends Struct({
  type: Field,
}) {
  public static types = {
    mint: 0,
    setTotalSupply: 1,
    setPaused: 2,
    setAdmin: 3,
  }

  public static fromType(type: number): AdminAction {
    return new AdminAction({ type: Field(type) })
  }
}
