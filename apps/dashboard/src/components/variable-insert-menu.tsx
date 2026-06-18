import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@nexura/ui';
import { BracesIcon } from 'lucide-react';
import { useState } from 'react';

export interface VariableItem {
  key: string;
  label: string;
  description: string;
  group: string;
}

export interface VariableInsertMenuProps {
  variables?: VariableItem[] | undefined;
  onInsert: (value: string) => void;
}

export function VariableInsertMenu({ variables = [], onInsert }: VariableInsertMenuProps) {
  const [open, setOpen] = useState(false);
  const groups = Array.from(new Set(variables.map((variable) => variable.group)));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <BracesIcon data-icon="inline-start" />
        Insert variable
      </Button>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Insert variable</DialogTitle>
          <DialogDescription>Choose a placeholder to insert into the active field.</DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[60vh] gap-4 overflow-y-auto p-1 md:grid-cols-3">
          {groups.length === 0 ? (
            <p className="col-span-full text-sm text-muted-foreground">No variables available.</p>
          ) : (
            groups.map((group) => (
              <section key={group} className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{group}</h3>
                {variables
                  .filter((variable) => variable.group === group)
                  .map((variable) => (
                    <Button
                      key={variable.key}
                      type="button"
                      variant="outline"
                      onClick={() => {
                        onInsert(variable.key);
                        setOpen(false);
                      }}
                      className="h-auto flex-col items-start justify-start gap-1 whitespace-normal rounded-lg border-border bg-background p-3 text-left hover:border-primary/50 hover:bg-accent"
                    >
                      <code className="text-xs text-primary">{variable.key}</code>
                      <p className="text-sm font-medium">{variable.label}</p>
                      <p className="text-xs leading-5 text-muted-foreground">{variable.description}</p>
                    </Button>
                  ))}
              </section>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
