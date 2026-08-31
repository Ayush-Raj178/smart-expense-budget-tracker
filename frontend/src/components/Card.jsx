import { motion } from 'framer-motion';

const Card = ({ children, className = '', ...props }) => {
  return (
    <motion.div
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className={`card ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export default Card;
