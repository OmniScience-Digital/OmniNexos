import { Link, useLocation } from "react-router-dom";

export default function Breadcrumbs() {
  let pathname = useLocation().pathname; // Get current path

  let pathSegments = pathname.split("/").filter(Boolean); // Remove empty segments

  pathSegments = pathSegments
    .filter((segment) => segment !== "dashboard") //remove dashboard
    .filter((segment) => segment !== "landing") //remove stockpile
    .map((segment) => {
      if (segment === "subcategories") return "inventorymanagementsystem";
      return segment;
    });


  if (pathSegments.length === 1 && /form$/i.test(pathSegments[0]) && pathSegments[0] !== "forms") {
    pathSegments = ["forms", pathSegments[0].replace(/form$/i, "")];
  }


  // Handle vehicleinspectionsystem/edit routes (keep the ID) and humanresources
  const removeSegmentIf = (arr: string[], a: string, b: string, seg: string) =>
    arr.includes(a) && arr.includes(b) ? arr.filter(s => s !== seg) : arr;

  pathSegments = removeSegmentIf(pathSegments, "vehicleinspectionsystem", "edit", "edit");
  pathSegments = removeSegmentIf(pathSegments, "humanresources", "edit", "edit");
  pathSegments = removeSegmentIf(pathSegments, "humanresources", "certificates", "certificates");


  // Function to truncate long text for mobile
  const truncateSegment = (segment: string, isLast: boolean = false) => {
    if (isLast) {
      // For the last segment, show more characters since it's the current page
      return segment.length > 20 ? `${segment.substring(0, 20)}...` : segment;
    }
    // For intermediate segments, be more aggressive with truncation
    return segment.length > 12 ? `${segment.substring(0, 12)}...` : segment;
  };

  return (
    <nav className="text-sm text-muted-foreground px-4">
      {/* Mobile View - Compact */}
      <div className="block md:hidden">
        <div className="flex items-center overflow-hidden">
          {/* Home Link for mobile */}
          <Link to="/landing" className="hover:underline shrink-0">
            Home
          </Link>

          {pathSegments.length > 0 && (
            <>
              <span className="mx-2 shrink-0">/</span>
              {/* Show only last segment on mobile if path is long */}
              {pathSegments.length > 2 ? (
                <>
                  <span className="text-gray-400 shrink-0">...</span>
                  <span className="mx-2 shrink-0">/</span>
                  <span className="text-primary font-medium">
                    {truncateSegment(decodeURIComponent(pathSegments[pathSegments.length - 1]), true)}
                  </span>
                </>
              ) : (
                // Show all segments if path is short
                pathSegments.map((segment, index) => {
                  const fullPath = `/${pathSegments.slice(0, index + 1).join("/")}`;
                  const isLast = index === pathSegments.length - 1;

                  return (
                    <div key={fullPath} className="flex items-center shrink-0">
                      {index > 0 && <span className="mx-2">/</span>}
                      {isLast ? (
                        <span className="text-primary font-medium">
                          {truncateSegment(decodeURIComponent(segment), true)}
                        </span>
                      ) : (
                        <Link to={fullPath} className="hover:underline">
                          {truncateSegment(decodeURIComponent(segment))}
                        </Link>
                      )}
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>
      </div>

      {/* Desktop View - Full */}
      <div className="hidden md:block">
        <ul className="flex items-center">
          {/* Home Link */}
          <li>
            <Link to="/landing" className="hover:underline">
              Landing
            </Link>
          </li>

          {pathSegments.map((segment, index) => {
            const fullPath = `/${pathSegments.slice(0, index + 1).join("/")}`;
            const isLast = index === pathSegments.length - 1;

            return (
              <li key={fullPath} className="flex items-center">
                <span className="mx-2">/</span>
                {isLast ? (
                  <span className="text-primary font-medium">
                    {decodeURIComponent(segment)}
                  </span>
                ) : (
                  <Link to={fullPath} className="hover:underline cursor-pointer">
                    {decodeURIComponent(segment)}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}