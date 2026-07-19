import { MissionComposer } from "@/components/mission-composer";

interface MissionPageProps {
  params: Promise<{ id: string }>;
}

export default async function MissionPage({ params }: MissionPageProps) {
  const { id } = await params;
  return <MissionComposer initialMissionId={id} />;
}
