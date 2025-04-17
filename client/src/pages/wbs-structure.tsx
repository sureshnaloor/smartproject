import { useParams } from "wouter";
import { WbsTree } from "@/components/project/wbs-tree";

export default function WbsStructure() {
  const params = useParams();
  const projectId = parseInt(params.projectId);

  return (
    <div className="flex-1 overflow-auto p-4 bg-gray-50">
      <WbsTree projectId={projectId} />
    </div>
  );
}
