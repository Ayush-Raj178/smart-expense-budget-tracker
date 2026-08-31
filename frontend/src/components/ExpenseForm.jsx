import { motion } from 'framer-motion';

const ExpenseForm = () => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="expense-form"
    >
      <h2>Add Expense</h2>
      <p>Expense form - to be implemented</p>
    </motion.div>
  );
};

export default ExpenseForm;
