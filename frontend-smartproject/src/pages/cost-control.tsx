import { useParams } from "wouter";
import { CostControl } from "@/components/project/cost-control";
import { motion } from "framer-motion";
import { DollarSign, PiggyBank, TrendingUp, BadgeDollarSign } from "lucide-react";

export default function CostControlPage() {
  const params = useParams();
  const projectId = params.projectId ? parseInt(params.projectId) : 0;

  return (
    <div className="flex-1 overflow-auto">
      {/* Header section with green gradient */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-100 border-b border-green-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col md:flex-row md:items-center md:justify-between"
          >
            <div className="mb-4 md:mb-0">
              <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                <DollarSign className="mr-2 h-6 w-6 text-green-600" />
                Cost Control
              </h1>
              <p className="text-gray-600 mt-1">
                Track and manage project budgets, actual costs, and variances
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="bg-white rounded-lg px-4 py-2 flex items-center shadow-sm border border-green-200">
                <PiggyBank className="h-5 w-5 text-green-600 mr-2" />
                <div>
                  <span className="text-xs text-gray-500 block">Budget Utilization</span>
                  <span className="font-medium">45%</span>
                </div>
              </div>
              <div className="bg-white rounded-lg px-4 py-2 flex items-center shadow-sm border border-green-200">
                <TrendingUp className="h-5 w-5 text-green-600 mr-2" />
                <div>
                  <span className="text-xs text-gray-500 block">CPI</span>
                  <span className="font-medium">1.02</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Main content with light background */}
      <div className="bg-stone-50 min-h-[calc(100vh-120px)]">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <CostControl projectId={projectId} />
          </motion.div>
        </div>
      </div>
    </div>
  );
}
