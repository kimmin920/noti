import { getSidebarStoryContent } from "@/lib/helpers/dashboard-story";
import type { ResourceState } from "@/lib/store/types";

export function SidebarStoryCard({
  resources,
  onGoResources,
}: {
  resources: ResourceState;
  onGoResources: () => void;
}) {
  const story = getSidebarStoryContent(resources, onGoResources);

  return (
    <div className="dashboard-story-card sidebar">
      <div className="dashboard-story-body">
        {story.lines.map((line, index) => (
          <div className="dashboard-story-line" key={index}>
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}
