import { useListEmployeesQuery, useListEmployeeTasksQuery } from "@/state/api";
import { pageContainer } from "@/components/shell/page-container";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DataGrid } from "@/components/shell/data-grid";
import { PageHeader } from "@/components/shell/page-header";
import { Toolbar, SearchField } from "@/components/shell/toolbar";
import {
  Edit,
  User,
  Plus,
  Calendar,
  Shield,
  Filter,
} from "lucide-react";
import { type ColumnDef } from "@tanstack/react-table";
import Footer from "@/components/layout/footer";
import Navbar from "@/components/layout/navbar";
import Loading from "@/components/widgets/loading";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { type Employee } from "@/types/hrd.types";

export default function HumanResourcesPage() {
  const navigate = useNavigate();

  // Sole consumer of Employee today, migrated for consistency and because
  // this read had no pagination before. EmployeeTaskTable here is the
  // dashboard task list/count — NOT the per-employee/per-document existence
  // checks used elsewhere before writes, which stay as direct Amplify calls.
  const { data: employees = [], isLoading: loading } = useListEmployeesQuery();
  const [filteredEmployees, setFilteredEmployees] = useState<
    (Employee | any)[]
  >([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const { data: tasks = [] } = useListEmployeeTasksQuery();
  const taskCount = tasks.length;

  // Filter employees based on search and active tab
  useEffect(() => {
    let filtered: any[] = employees;

    // Apply search filter
    if (searchTerm) {
      if (activeTab === "expiring") {
        // Search in tasks
        filtered = tasks
          .filter(
            (task) =>
              task.employeeName
                .toLowerCase()
                .includes(searchTerm.toLowerCase()) ||
              task.employeeId
                .toLowerCase()
                .includes(searchTerm.toLowerCase()) ||
              task.taskType.toLowerCase().includes(searchTerm.toLowerCase()) ||
              task.documentType
                .toLowerCase()
                .includes(searchTerm.toLowerCase()),
          )
          .map((task) => ({
            id: task.id,
            employeeId: task.employeeId,
            firstName: task.employeeName.split(" ")[0],
            surname: task.employeeName.split(" ")[1] || "",
            taskType: task.taskType,
            documentType: task.documentType,
            isTask: true,
          }));
      } else {
        // Search in employees
        filtered = filtered.filter(
          (employee) =>
            `${employee.firstName} ${employee.surname}`
              .toLowerCase()
              .includes(searchTerm.toLowerCase()) ||
            employee.employeeId
              ?.toLowerCase()
              .includes(searchTerm.toLowerCase()) ||
            employee.knownAs?.toLowerCase().includes(searchTerm.toLowerCase()),
        );
      }
    } else {
      // Apply tab filter when no search term
      if (activeTab === "drivers") {
        filtered = filtered.filter((employee) => employee.authorizedDriver);
      } else if (activeTab === "expiring") {
        const tasksWithEmployeeInfo = tasks.map((task) => ({
          id: task.id,
          employeeId: task.employeeId,
          firstName: task.employeeName.split(" ")[0],
          surname: task.employeeName.split(" ")[1] || "",
          taskType: task.taskType,
          documentType: task.documentType,
          isTask: true,
        }));
        filtered = tasksWithEmployeeInfo;
      }
    }

    setFilteredEmployees(filtered);
  }, [searchTerm, activeTab, employees, tasks]);

  const getInitials = (firstName: string, surname: string) => {
    return `${firstName.charAt(0)}${surname.charAt(0)}`.toUpperCase();
  };

  const getStatusBadge = (employee: Employee) => {
    if (employee.authorizedDriver) {
      return (
        <Badge
          variant="default"
          className="text-xs bg-blue-100 text-blue-800 hover:bg-blue-100"
        >
          Driver
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="text-xs">
        Active
      </Badge>
    );
  };

  const getStatusCountBadge = (x: number) => {
    if (x > 0) {
      return (
        <Badge
          variant="default"
          className="text-xs bg-red-500 text-white hover:bg-red-100"
        >
          {x}
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="text-xs">
        {x}
      </Badge>
    );
  };

  // Mobile-friendly columns
  const employeeColumns: ColumnDef<object, any>[] = [
    {
      accessorKey: "firstName",
      header: "First Name",
      cell: ({ row }: { row: any }) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 border-2 border-slate-100">
            <AvatarFallback className="bg-linear-to-br from-blue-500 to-purple-600 text-white text-sm font-bold">
              {getInitials(row.original.firstName, row.original.surname)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="font-semibold text-slate-600">
              {row.original.firstName} {row.original.surname}
            </span>
            <span className="text-sm text-slate-500">
              {row.original.employeeId}
            </span>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "knownAs",
      header: () => <div className="hidden lg:block">Known As</div>,
      cell: ({ row }: { row: any }) => (
        <div className="text-sm font-medium text-slate-700 hidden lg:block">
          {row.original.knownAs || "-"}
        </div>
      ),
    },
    {
      accessorKey: "employeeNumber",
      header: () => <div className="hidden lg:block">Employee No</div>,
      cell: ({ row }: { row: any }) => (
        <div className="text-sm font-medium text-slate-700 hidden lg:block">
          {row.original.employeeNumber || "-"}
        </div>
      ),
    },
    {
      accessorKey: "DocExpCnt",
      header: "Doc Exp Count",
      cell: ({ row }: { row: any }) => {
        const employeeId = row.original.employeeId;
        const count = tasks.filter(
          (task) => task.employeeId === employeeId,
        ).length;

        return (
          <div className="flex justify-start">
            {getStatusCountBadge(count as number)}
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }: { row: any }) => (
        <div className="flex justify-start">{getStatusBadge(row.original)}</div>
      ),
    },

    {
      id: "edit",
      header: "Edit",
      cell: ({ row }: { row: any }) => (
        <div
          onClick={() =>
            navigate(`/humanresourcesdepartment/edit/${row.original.id}`)
          }
          className="cursor-pointer text-slate-700"
        >
          <Edit
            className="
    h-4 w-4 mr-2
    cursor-pointer
    hover:bg-slate-100
    active:bg-slate-200
    active:scale-95
    rounded
    transition
    inline-block
  "
          />
        </div>
      ),
    },
  ];

  const taskColumns: ColumnDef<object, any>[] = [
    {
      accessorKey: "employee",
      header: "Employee",
      cell: ({ row }: { row: any }) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 border-2 border-slate-100">
            <AvatarFallback className="bg-linear-to-br from-blue-500 to-purple-600 text-white text-sm font-bold">
              {getInitials(row.original.firstName, row.original.surname)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="font-semibold text-slate-600">
              {row.original.firstName} {row.original.surname}
            </span>
            <span className="text-sm text-foreground">
              {row.original.employeeId}
            </span>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "taskType",
      header: "Task Type",
      cell: ({ row }: { row: any }) => (
        <div className="text-sm text-slate-600">
          {row.original.taskType?.toUpperCase()}
        </div>
      ),
    },
    {
      accessorKey: "documentType",
      header: "Document Type",
      cell: ({ row }: { row: any }) => (
        <Badge variant="destructive" className="text-xs text-white ">
          {" "}
          {row.original.documentType}
        </Badge>
      ),
    },
  ];

  const data = Array.isArray(filteredEmployees)
    ? filteredEmployees.map((employee) => ({
        id: employee.id,
        employeeId: employee.employeeId,
        firstName: employee.firstName,
        surname: employee.surname,
        knownAs: employee.knownAs,
        employeeNumber: employee.employeeNumber,
        authorizedDriver: employee.authorizedDriver,
        passportExpiry: employee.passportExpiry,
        driversLicenseExpiry: employee.driversLicenseExpiry,
        taskType: employee.taskType,
        documentType: employee.documentType,
      }))
    : [];

  const stats = {
    total: employees.length,
    drivers: employees.filter((e) => e.authorizedDriver).length,
    expiring: employees.filter((e) => {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      return (
        (e.passportExpiry && new Date(e.passportExpiry) <= thirtyDaysFromNow) ||
        (e.driversLicenseExpiry &&
          new Date(e.driversLicenseExpiry) <= thirtyDaysFromNow)
      );
    }).length,
    tasks: taskCount,
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-background from-slate-50 to-blue-50/30">
        <Navbar />
        <Loading />
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background from-slate-50 to-blue-50/30">
      <Navbar />

      <main className="flex-1 mt-25 pb-20">
        <div className={pageContainer()}>
          <PageHeader
            title="Employees"
            description="Manage your workforce, track certifications and ensure compliance."
            actions={
              <>
                <Button
                  variant="outline"
                  className="cursor-pointer"
                  onClick={() => navigate("/humanresourcesdepartment/attendance")}
                >
                  View Attendance
                </Button>
                <Button
                  onClick={() => navigate("/humanresourcesdepartment/create")}
                  className="cursor-pointer bg-green-600 hover:bg-green-700"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Employee
                </Button>
              </>
            }
          />

          {/* Summary */}
          <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { label: "Total Employees", value: stats.total, icon: User },
              { label: "Authorized Drivers", value: stats.drivers, icon: Shield },
              { label: "Expiring Soon", value: stats.tasks, icon: Calendar },
            ].map(({ label, value, icon: StatIcon }) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
              >
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-2xl font-semibold leading-tight">{value}</p>
                </div>
                <StatIcon className="h-5 w-5 text-muted-foreground" />
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div role="tablist" className="mb-4 flex gap-6 border-b border-border">
            {[
              { key: "all", label: "All Employees", count: employees.length },
              { key: "drivers", label: "Drivers", count: stats.drivers },
              { key: "expiring", label: "Expiring", count: taskCount },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={activeTab === t.key}
                onClick={() => setActiveTab(t.key)}
                className={`-mb-px flex cursor-pointer items-center gap-2 border-b-2 px-0.5 py-2.5 text-sm transition-colors ${
                  activeTab === t.key
                    ? "border-primary font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
                <Badge variant="secondary" className="px-1.5 py-0 text-xs font-normal">
                  {t.count}
                </Badge>
              </button>
            ))}
          </div>

          <Toolbar>
            <SearchField
              aria-label="Search"
              placeholder={activeTab === "expiring" ? "Search tasks..." : "Search employees..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="cursor-pointer">
                  <Filter className="h-4 w-4 mr-2" />
                  Filter
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem className="cursor-pointer" onClick={() => setActiveTab("all")}>
                  All Employees
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer" onClick={() => setActiveTab("drivers")}>
                  Authorized Drivers
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer" onClick={() => setActiveTab("expiring")}>
                  Documents Expiring
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </Toolbar>

          <DataGrid
            key={activeTab === "expiring" ? "tasks" : "employees"}
            data={data}
            columns={(activeTab === "expiring" ? taskColumns : employeeColumns) as any}
            pageSize={10}
            storageKey={activeTab === "expiring" ? "taskTablePagination" : "employeeTablePagination"}
            noun={activeTab === "expiring" ? "tasks" : "employees"}
            emptyMessage="Nothing found."
          />
        </div>
      </main>
      <Footer />
    </div>
  );
}