import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { Home, Receipt, Wallet, Bell, LogOut, User } from 'lucide-react';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <motion.nav
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="bg-[#0f1420] border-b border-gray-800 shadow-lg"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center space-x-2">
            <Wallet className="h-8 w-8 text-primary" />
            <span className="text-xl font-bold text-white">SmartExpense</span>
          </Link>

          {/* Navigation Links */}
          {user && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex items-center space-x-6"
            >
              <Link
                to="/dashboard"
                className="flex items-center space-x-1 text-gray-300 hover:text-white transition-colors duration-200"
              >
                <Home className="w-4 h-4" />
                <span>Dashboard</span>
              </Link>
              <Link
                to="/expenses"
                className="flex items-center space-x-1 text-gray-300 hover:text-white transition-colors duration-200"
              >
                <Receipt className="w-4 h-4" />
                <span>Expenses</span>
              </Link>
              <Link
                to="/budgets"
                className="flex items-center space-x-1 text-gray-300 hover:text-white transition-colors duration-200"
              >
                <Wallet className="w-4 h-4" />
                <span>Budgets</span>
              </Link>
              <Link
                to="/notifications"
                className="flex items-center space-x-1 text-gray-300 hover:text-white transition-colors duration-200"
              >
                <Bell className="w-4 h-4" />
                <span>Notifications</span>
              </Link>

              <div className="h-6 w-px bg-gray-700" />

              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2 text-gray-300">
                  <User className="w-4 h-4" />
                  <span className="text-sm">{user.name || 'User'}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-1 text-gray-400 transition-colors duration-200 hover:text-primary"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="text-sm">Logout</span>
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </motion.nav>
  );
};

export default Navbar;
