import { Eye } from "lucide-react"

import { AnimatedFeatureSpotlight } from "@/components/ui/feature-spotlight"

export default function AnimatedFeatureSpotlightDemo() {
  return (
    <div className="flex items-center justify-center w-full min-h-screen bg-muted p-4">
      <AnimatedFeatureSpotlight
        preheaderIcon={<Eye className="h-4 w-4" />}
        preheaderText="See the Market From Every Angle"
        heading={
          <>
            <span className="text-primary">Uncover</span> Untapped{" "}
            <span className="text-primary">Potential</span>
          </>
        }
        description="Filter the global market instantly with powerful screeners tailored to your trading style. Quickly identify the most promising assets based on specific criteria and market conditions, so you never miss the next big thing."
        buttonText="Try Now for Free"
        buttonProps={{ onClick: () => alert("Button Clicked!") }}
        imageUrl="https://forecaster.biz/wp-content/uploads/2025/06/screener-1536x993.avif"
        imageAlt="A screenshot of the market screener feature"
      />
    </div>
  )
}
