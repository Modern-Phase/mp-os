import { useQuery } from "convex/react";
import { api } from "@cvx/_generated/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu";
import { Button } from "@/ui/button";
import { ChevronUp, ChevronDown, Check, Plus, Users } from "lucide-react";
import { User } from "~/types";
import { useState } from "react";
import { CreateOrganizationDialog } from "./CreateOrganizationDialog";

export function OrganizationSwitcher({ user }: { user: User }) {
  const organizations = useQuery(api.organizations.getMyOrganizations);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="gap-2 px-2 data-[state=open]:bg-primary/5"
          >
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <p className="text-sm font-medium text-primary/80">Personal</p>
            </div>
            <span className="flex flex-col items-center justify-center">
              <ChevronUp className="relative top-[3px] h-[14px] w-[14px] stroke-[1.5px] text-primary/60" />
              <ChevronDown className="relative bottom-[3px] h-[14px] w-[14px] stroke-[1.5px] text-primary/60" />
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent sideOffset={8} className="min-w-56 bg-card p-2">
          <DropdownMenuLabel className="text-xs font-normal text-primary/60">
            Personal Account
          </DropdownMenuLabel>
          <DropdownMenuItem className="h-10 w-full cursor-pointer justify-between rounded-md bg-secondary px-2">
            <div className="flex items-center gap-2">
              {user.avatarUrl ? (
                <img
                  className="h-6 w-6 rounded-full object-cover"
                  src={user.avatarUrl}
                  alt={user.username}
                />
              ) : (
                <div className="h-6 w-6 rounded-full bg-gradient-to-br from-lime-400 to-blue-500" />
              )}
              <p className="text-sm font-medium">
                {user.username || "Personal"}
              </p>
            </div>
            <Check className="h-4 w-4 text-primary" />
          </DropdownMenuItem>

          {organizations && organizations.length > 0 && (
            <>
              <DropdownMenuSeparator className="mx-0 my-2" />
              <DropdownMenuLabel className="text-xs font-normal text-primary/60">
                Organizations
              </DropdownMenuLabel>
              {organizations.map((org) => (
                <DropdownMenuItem
                  key={org._id}
                  className="h-10 w-full cursor-pointer justify-between rounded-md px-2"
                >
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center">
                      <span className="text-[10px] font-bold">
                        {org.name.charAt(0)}
                      </span>
                    </div>
                    <p className="text-sm font-medium">{org.name}</p>
                  </div>
                </DropdownMenuItem>
              ))}
            </>
          )}

          <DropdownMenuSeparator className="mx-0 my-2" />
          <DropdownMenuItem
            className="h-10 w-full cursor-pointer gap-2 rounded-md px-2"
            onSelect={() => setIsCreateDialogOpen(true)}
          >
            <Plus className="h-4 w-4" />
            <span className="text-sm font-medium">Create Organization</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateOrganizationDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />
    </>
  );
}
