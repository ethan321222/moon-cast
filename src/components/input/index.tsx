import InternalInput from "./Input";
import Password from "./Password";

export type { InputProps } from "./Input";

export const Input = Object.assign(InternalInput, {
  Password,
});

export default Input;
