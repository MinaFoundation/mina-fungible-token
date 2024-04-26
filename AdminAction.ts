import { Field, Struct } from "o1js"

/** Enumerates the different types of administrative actions that can be performed on a token. */
export class AdminAction extends Struct({
  type: Field,
}) {
  public static types = {
    mint: 0,
    burn: 1,
    setTotalSupply: 2,
    setPaused: 3,
    setAdmin: 4,
  }

  public static fromType(type: number): AdminAction {
    return new AdminAction({ type: Field(type) })
  }
}
