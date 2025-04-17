import { useParams } from "wouter";
import { CostControl } from "@/components/project/cost-control";

export default function CostControlPage() {
  const params = useParams();
  const projectId = parseInt(params.projectId);

  return (
    <div className="flex-1 overflow-auto p-4 bg-gray-50">
      <CostControl projectId={projectId} />
    </div>
  );
}
