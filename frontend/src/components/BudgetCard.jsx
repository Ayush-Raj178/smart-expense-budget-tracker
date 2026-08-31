import { motion } from 'framer-motion';

const BudgetCard = ({ budget }) => {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="budget-card"
    >
      <h3>{budget.category}</h3>
      <p>Budget card - to be implemented</p>
    </motion.div>
  );
};

export default BudgetCard;
