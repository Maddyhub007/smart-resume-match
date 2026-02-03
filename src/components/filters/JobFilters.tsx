import { Filter, ChevronDown } from "lucide-react";
import { useState } from "react";

interface FilterState {
  matchScore: string;
  location: string;
  experience: string;
}

interface JobFiltersProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
}

const JobFilters = ({ filters, onFilterChange }: JobFiltersProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleChange = (key: keyof FilterState, value: string) => {
    onFilterChange({ ...filters, [key]: value });
  };

  return (
    <div className="card-elevated p-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between md:hidden"
      >
        <span className="flex items-center gap-2 font-medium text-foreground">
          <Filter className="w-5 h-5" />
          Filters
        </span>
        <ChevronDown
          className={`w-5 h-5 text-muted-foreground transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      <div className={`${isOpen ? "block" : "hidden"} md:block mt-4 md:mt-0`}>
        <div className="flex items-center gap-2 mb-4 hidden md:flex">
          <Filter className="w-5 h-5 text-muted-foreground" />
          <span className="font-medium text-foreground">Filters</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Match Score */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Match Score
            </label>
            <select
              value={filters.matchScore}
              onChange={(e) => handleChange("matchScore", e.target.value)}
              className="input-field text-sm"
            >
              <option value="">All Scores</option>
              <option value="90">90%+</option>
              <option value="80">80%+</option>
              <option value="70">70%+</option>
              <option value="60">60%+</option>
            </select>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Location
            </label>
            <select
              value={filters.location}
              onChange={(e) => handleChange("location", e.target.value)}
              className="input-field text-sm"
            >
              <option value="">All Locations</option>
              <option value="remote">Remote</option>
              <option value="san-francisco">San Francisco</option>
              <option value="new-york">New York</option>
              <option value="seattle">Seattle</option>
              <option value="austin">Austin</option>
            </select>
          </div>

          {/* Experience */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">
              Experience Level
            </label>
            <select
              value={filters.experience}
              onChange={(e) => handleChange("experience", e.target.value)}
              className="input-field text-sm"
            >
              <option value="">All Levels</option>
              <option value="entry">Entry Level</option>
              <option value="mid">Mid Level</option>
              <option value="senior">Senior</option>
              <option value="lead">Lead / Principal</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobFilters;
