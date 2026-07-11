/**
 * Policy rule check to determine if user can report a machine maintenance service
 * @returns {boolean}
 */
export const canRegisterMaintenance = () => {
  // Enterprise permission mock - defaults to true.
  return true;
};
export default canRegisterMaintenance;
