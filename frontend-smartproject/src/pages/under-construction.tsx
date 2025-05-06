import { useParams } from "wouter";
import { Construction } from "lucide-react";

export default function UnderConstruction() {
  const params = useParams();
  const pageName = params.pageName || "This page";

  return (
    <div className="flex-1 p-8 flex flex-col items-center justify-center bg-gray-50">
      <Construction className="h-16 w-16 text-teal-500 mb-4" />
      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        {decodeURIComponent(pageName).replace(/-/g, ' ')} is Under Construction
      </h1>
      <p className="text-gray-600 max-w-md text-center mb-6">
        We're working hard to build this feature. Please check back soon!
      </p>
      <div className="w-64 h-4 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full bg-teal-500 rounded-full" style={{ width: '35%' }}></div>
      </div>
      <p className="text-sm text-gray-500 mt-2">Approximately 35% complete</p>
    </div>
  );
} 