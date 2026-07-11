/**
 * Policy rule check to determine if user can start a machinery labor journey
 * @returns {boolean}
 */
export const canStartOperation = () => {
  // Enterprise permission mock - defaults to true.
  return true;
};
export default canStartOperation;
