import type { PublicKey, State } from 'snarkyjs';

interface Hookable {
  hooks: State<PublicKey>;
}

export default Hookable;
