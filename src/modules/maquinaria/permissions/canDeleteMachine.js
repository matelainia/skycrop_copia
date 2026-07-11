/**
 * Policy rule check to determine if user can delete machinery from ERP
 * @returns {boolean}
 */
export const canDeleteMachine = () => {
  // Enterprise permission mock - defaults to true.
  return true;
};
export default canDeleteMachine;
