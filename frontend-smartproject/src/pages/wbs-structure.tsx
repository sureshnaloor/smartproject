import { useParams } from "wouter";
import { WbsTree } from "@/components/project/wbs-tree";
import { motion } from "framer-motion";
import { Archive, FileDigit, Info, ListTree } from "lucide-react";

export default function WbsStructure() {
  const params = useParams();
  const projectId = params.projectId ? parseInt(params.projectId) : 0;

  return (
    <div className="flex-1 overflow-auto">
      {/* Header section with teal gradient */}
      <div className="bg-gradient-to-r from-teal-50 to-teal-100 border-b border-teal-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col md:flex-row md:items-center md:justify-between"
          >
            <div className="mb-4 md:mb-0">
              <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                <ListTree className="mr-2 h-6 w-6 text-teal-600" />
                Work Breakdown Structure
              </h1>
              <p className="text-gray-600 mt-1">
                Organize and manage project scope in a hierarchical structure
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="bg-white rounded-md px-3 py-2 flex items-center shadow-sm border border-gray-200">
                <Info className="h-4 w-4 text-teal-600 mr-2" />
                <span className="text-sm text-gray-600">Drag items to reorder</span>
              </div>
              <div className="bg-white rounded-md px-3 py-2 flex items-center shadow-sm border border-gray-200">
                <FileDigit className="h-4 w-4 text-teal-600 mr-2" />
                <span className="text-sm text-gray-600">Double-click to edit</span>
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
            <WbsTree projectId={projectId} />
          </motion.div>
        </div>
      </div>
    </div>
  );
}
