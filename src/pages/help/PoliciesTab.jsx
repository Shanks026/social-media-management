import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { POLICIES, POLICIES_LAST_UPDATED } from './policies-data'

export default function PoliciesTab() {
  return (
    <div className="max-w-2xl space-y-10">
      <div className="space-y-1">
        <h2 className="text-2xl font-normal tracking-tight bricolage">Policies</h2>
        <p className="text-sm text-muted-foreground font-normal">
          Last updated {POLICIES_LAST_UPDATED}. Please read these carefully before using Tercero.
        </p>
      </div>

      <Accordion type="single" collapsible className="space-y-3">
        {POLICIES.map((policy) => (
          <AccordionItem
            key={policy.id}
            value={policy.id}
            className="border border-border/50 rounded-xl px-5 overflow-hidden"
          >
            <AccordionTrigger className="text-base font-medium bricolage hover:no-underline py-4">
              {policy.title}
            </AccordionTrigger>
            <AccordionContent className="pb-6">
              <div className="space-y-6">
                {policy.sections.map((section, i) => (
                  <div key={i} className="space-y-1.5">
                    <p className="text-sm font-medium text-foreground">{section.heading}</p>
                    <p className="text-sm text-muted-foreground font-normal leading-relaxed">{section.body}</p>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}
