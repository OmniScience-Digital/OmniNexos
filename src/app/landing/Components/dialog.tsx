import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DialogDashboard({
  open,
  setOpen,
  name,
  setName,
  addDashboard,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  name: string;
  setName: (name: string) => void;
  addDashboard: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Dashboard</DialogTitle>
          <DialogDescription>
            Enter details to create a new dashboard.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Name Input */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="col-span-3"
              autoComplete="off"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={addDashboard}>Create Dashboard</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
