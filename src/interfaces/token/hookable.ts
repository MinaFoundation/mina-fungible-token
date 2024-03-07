import type { PublicKey, State } from 'o1js';

interface Hookable {
  hooks: State<PublicKey>;
}

export default Hookable;
