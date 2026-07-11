/**
 * Policy rule check to determine if user can create/register machinery
 * @returns {boolean}
 */
export const canCreateMachine = () => {
  // Enterprise permission mock - defaults to true.
  return true;
};
export default canCreateMachine;
