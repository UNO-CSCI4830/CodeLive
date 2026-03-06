/* ──────────────────────────────────────────────────────────
 *  Static catalogue data derived from /content.
 *  Replace with API calls once the backend catalogue
 *  endpoints are available.
 * ────────────────────────────────────────────────────────── */

export type Difficulty = "easy" | "medium" | "hard";

export interface Problem {
  id: string;
  title: string;
  difficulty: Difficulty;
  tags?: string[];
}

export interface SubCategory {
  slug: string;
  label: string;
  problems: Problem[];
}

export interface Category {
  slug: string;
  label: string;
  description: string;
  icon: string; // lucide icon name (used as a key in the component)
  problemCount: number;
  subCategories: SubCategory[];
}

/* ── Frontend ─────────────────────────────────────────── */

const frontendSubs: SubCategory[] = [
  {
    slug: "a11y",
    label: "Accessibility",
    problems: [
      { id: "a11y-button-roles", title: "Accessible Button Roles", difficulty: "easy", tags: ["react", "accessibility", "aria"] },
      { id: "a11y-combobox", title: "Accessible Combobox Autocomplete", difficulty: "hard", tags: ["react", "accessibility", "combobox"] },
      { id: "a11y-data-table", title: "Accessible Data Table", difficulty: "hard", tags: ["react", "accessibility", "table"] },
      { id: "a11y-form-labels", title: "Accessible Form Labels", difficulty: "easy", tags: ["react", "accessibility", "forms"] },
      { id: "a11y-keyboard-nav", title: "Keyboard-Navigable Dropdown", difficulty: "medium", tags: ["react", "accessibility", "keyboard-navigation"] },
      { id: "a11y-live-region", title: "ARIA Live Region Announcements", difficulty: "medium", tags: ["react", "accessibility", "aria-live"] },
      { id: "a11y-modal-trap", title: "Accessible Modal with Focus Trap", difficulty: "medium", tags: ["react", "accessibility", "focus-management"] },
      { id: "a11y-roving-tabindex", title: "Roving Tabindex Toolbar", difficulty: "hard", tags: ["react", "accessibility", "roving-tabindex"] },
      { id: "a11y-skip-nav", title: "Skip Navigation Link", difficulty: "easy", tags: ["react", "accessibility", "keyboard-navigation"] },
    ],
  },
  {
    slug: "api",
    label: "API Integration",
    problems: [
      { id: "api-fetch-display", title: "Fetch & Display Data", difficulty: "easy", tags: ["react", "api", "fetch"] },
      { id: "api-form-submit", title: "Form Submission with API", difficulty: "easy", tags: ["react", "api", "forms"] },
      { id: "api-infinite-scroll", title: "Infinite Scroll Feed", difficulty: "medium", tags: ["react", "api", "infinite-scroll"] },
      { id: "api-optimistic-update", title: "Optimistic Updates", difficulty: "medium", tags: ["react", "api", "optimistic-update"] },
      { id: "api-pagination", title: "Paginated Data Table", difficulty: "medium", tags: ["react", "api", "pagination"] },
      { id: "api-polling", title: "Auto-Polling Status", difficulty: "easy", tags: ["react", "api", "polling"] },
      { id: "api-realtime-sse", title: "Real-Time Server-Sent Events", difficulty: "hard", tags: ["react", "api", "sse"] },
      { id: "api-request-dedup", title: "Request Deduplication & Race Conditions", difficulty: "hard", tags: ["react", "api", "race-condition"] },
      { id: "api-retry-backoff", title: "Retry with Exponential Backoff", difficulty: "hard", tags: ["react", "api", "retry"] },
    ],
  },
  {
    slug: "component",
    label: "UI Components",
    problems: [
      { id: "component-accordion", title: "Accordion", difficulty: "easy", tags: ["react", "state", "interactive"] },
      { id: "component-autocomplete", title: "Autocomplete Search", difficulty: "medium", tags: ["react", "state", "filtering"] },
      { id: "component-carousel", title: "Infinite Carousel", difficulty: "hard", tags: ["react", "effects", "intervals"] },
      { id: "component-multi-step-form", title: "Multi-Step Form", difficulty: "medium", tags: ["react", "forms", "validation"] },
      { id: "component-optimistic-update", title: "Optimistic Todo List", difficulty: "hard", tags: ["react", "async", "optimistic-ui"] },
      { id: "component-sortable-list", title: "Sortable List", difficulty: "medium", tags: ["react", "state", "lists"] },
      { id: "component-star-rating", title: "Star Rating", difficulty: "easy", tags: ["react", "state", "interactive"] },
      { id: "component-toggle-switch", title: "Toggle Switch", difficulty: "easy", tags: ["react", "state", "aria"] },
      { id: "component-virtualized-list", title: "Virtualized List", difficulty: "hard", tags: ["react", "performance", "virtualization"] },
    ],
  },
  {
    slug: "counter",
    label: "Basics",
    problems: [
      { id: "counter-component", title: "Counter Component", difficulty: "easy", tags: ["react", "hooks", "state"] },
    ],
  },
  {
    slug: "css",
    label: "CSS & Layout",
    problems: [
      { id: "css-animated-card", title: "Animated Card Effects", difficulty: "hard", tags: ["css", "animation", "transitions"] },
      { id: "css-center-card", title: "Center a Card", difficulty: "easy", tags: ["css", "flexbox", "centering"] },
      { id: "css-flexbox-navbar", title: "Flexbox Navbar", difficulty: "easy", tags: ["css", "flexbox", "navbar"] },
      { id: "css-holy-grail", title: "Holy Grail Layout", difficulty: "medium", tags: ["css", "grid", "layout"] },
      { id: "css-masonry-grid", title: "Masonry Grid", difficulty: "hard", tags: ["css", "masonry", "responsive"] },
      { id: "css-responsive-dashboard", title: "Responsive Dashboard", difficulty: "hard", tags: ["css", "grid", "responsive"] },
      { id: "css-responsive-grid", title: "Responsive Card Grid", difficulty: "easy", tags: ["css", "grid", "responsive"] },
      { id: "css-sticky-sidebar", title: "Sticky Sidebar Layout", difficulty: "medium", tags: ["css", "grid", "sticky"] },
      { id: "css-tooltip", title: "CSS Tooltip with Arrow", difficulty: "medium", tags: ["css", "tooltip", "pseudo-elements"] },
    ],
  },
  {
    slug: "hook",
    label: "Custom Hooks",
    problems: [
      { id: "hook-use-debounce", title: "useDebounce Hook", difficulty: "medium", tags: ["react", "hooks", "debounce"] },
      { id: "hook-use-fetch", title: "useFetch Hook", difficulty: "medium", tags: ["react", "hooks", "fetch"] },
      { id: "hook-use-form", title: "useForm Hook", difficulty: "hard", tags: ["react", "hooks", "forms", "validation"] },
      { id: "hook-use-local-storage", title: "useLocalStorage Hook", difficulty: "easy", tags: ["react", "hooks", "localStorage"] },
      { id: "hook-use-media-query", title: "useMediaQuery Hook", difficulty: "medium", tags: ["react", "hooks", "media-query"] },
      { id: "hook-use-previous", title: "usePrevious Hook", difficulty: "easy", tags: ["react", "hooks", "refs"] },
      { id: "hook-use-toggle", title: "useToggle Hook", difficulty: "easy", tags: ["react", "hooks", "state"] },
      { id: "hook-use-undo-redo", title: "useUndoRedo Hook", difficulty: "hard", tags: ["react", "hooks", "undo-redo"] },
      { id: "hook-use-websocket", title: "useWebSocket Hook", difficulty: "hard", tags: ["react", "hooks", "websocket"] },
    ],
  },
  {
    slug: "perf",
    label: "Performance",
    problems: [
      { id: "perf-code-splitting", title: "Dynamic Import & Code Splitting", difficulty: "hard", tags: ["react", "performance", "lazy"] },
      { id: "perf-concurrent-transitions", title: "Concurrent Rendering with Transitions", difficulty: "hard", tags: ["react", "performance", "useTransition"] },
      { id: "perf-debounce-search", title: "Debounced Search Input", difficulty: "easy", tags: ["react", "performance", "debounce"] },
      { id: "perf-expensive-compute", title: "Memoize Expensive Computation", difficulty: "medium", tags: ["react", "performance", "useMemo"] },
      { id: "perf-lazy-image", title: "Lazy Loading Images", difficulty: "easy", tags: ["react", "performance", "lazy-loading"] },
      { id: "perf-memo-list", title: "Memoized List Rendering", difficulty: "easy", tags: ["react", "performance", "memo"] },
      { id: "perf-render-batching", title: "Optimize Render Batching", difficulty: "medium", tags: ["react", "performance", "useCallback"] },
      { id: "perf-virtualized-scroll", title: "Virtualized Scrolling List", difficulty: "medium", tags: ["react", "performance", "virtualization"] },
      { id: "perf-web-worker", title: "Offload to Web Worker", difficulty: "hard", tags: ["react", "performance", "web-worker"] },
    ],
  },
  {
    slug: "state",
    label: "State Management",
    problems: [
      { id: "state-finite-machine", title: "Finite State Machine", difficulty: "hard", tags: ["react", "useReducer", "state-machine"] },
      { id: "state-form-wizard", title: "Multi-Step Form Wizard", difficulty: "hard", tags: ["react", "useReducer", "forms"] },
      { id: "state-mini-redux", title: "Mini Redux Store", difficulty: "hard", tags: ["react", "context", "useReducer"] },
      { id: "state-multi-filter", title: "Multi-Criteria Filter", difficulty: "medium", tags: ["react", "useReducer", "filtering"] },
      { id: "state-notification-queue", title: "Notification Queue", difficulty: "medium", tags: ["react", "useReducer", "notifications"] },
      { id: "state-shopping-cart", title: "Shopping Cart Reducer", difficulty: "easy", tags: ["react", "useReducer", "shopping-cart"] },
      { id: "state-tabs-compound", title: "Compound Tabs Component", difficulty: "medium", tags: ["react", "context", "compound-components"] },
      { id: "state-theme-context", title: "Theme Context Provider", difficulty: "easy", tags: ["react", "context", "theme"] },
      { id: "state-todo-reducer", title: "Todo List with useReducer", difficulty: "easy", tags: ["react", "useReducer", "todo"] },
    ],
  },
];

/* ── LeetCode ─────────────────────────────────────────── */

const leetcodeSubs: SubCategory[] = [
  {
    slug: "arrays-and-hashing",
    label: "Arrays & Hashing",
    problems: [
      { id: "arrays-are-isomorphic", title: "Arrays Are Isomorphic", difficulty: "easy" },
      { id: "count-subarrays-sum-to-k", title: "Count Subarrays with Exact Sum", difficulty: "medium" },
      { id: "equal-residues-after-increments", title: "Equal Residues After Increments", difficulty: "medium" },
      { id: "find-balance-pivot", title: "Find Balance Pivot", difficulty: "easy" },
      { id: "find-pair-with-target-sum", title: "Find Pair with Target Sum", difficulty: "easy" },
      { id: "first-missing-positive", title: "First Missing Positive", difficulty: "hard" },
      { id: "frequency-sort-array", title: "Frequency Sort Array", difficulty: "medium" },
      { id: "group-words-by-anagram", title: "Group Words by Anagram", difficulty: "easy" },
      { id: "longest-consecutive-streak", title: "Longest Consecutive Streak", difficulty: "medium" },
      { id: "majority-element-over-n2", title: "Majority Element over n/2", difficulty: "easy" },
      { id: "majority-elements-over-n3", title: "Majority Elements over n/3", difficulty: "medium" },
      { id: "min-subarray-to-make-sum-divisible", title: "Min Subarray to Make Sum Divisible", difficulty: "hard" },
      { id: "nearby-duplicate-within-k", title: "Nearby Duplicate Within K", difficulty: "easy" },
      { id: "product-except-self", title: "Array of Products Except Self", difficulty: "medium" },
      { id: "top-k-frequent-elements", title: "Top-K Frequent Elements", difficulty: "medium" },
    ],
  },
  {
    slug: "backtracking",
    label: "Backtracking",
    problems: [
      { id: "choose-k-from-n", title: "Choose K from 1..N", difficulty: "medium" },
      { id: "combination-sum-no-reuse", title: "Combination Sum Without Reuse", difficulty: "medium" },
      { id: "combination-sum-unbounded", title: "Combination Sum with Unlimited Picks", difficulty: "medium" },
      { id: "generate-parentheses", title: "Generate Balanced Parentheses", difficulty: "medium" },
      { id: "n-queens", title: "Place N Queens on an N×N Board", difficulty: "hard" },
      { id: "palindrome-partitioning", title: "Partition a String into Palindromes", difficulty: "medium" },
      { id: "permute-distinct", title: "Permutations of Distinct Elements", difficulty: "medium" },
      { id: "permute-unique", title: "Unique Permutations with Duplicates", difficulty: "medium" },
      { id: "phone-letter-combinations", title: "Phone Keypad Letter Combinations", difficulty: "medium" },
      { id: "restore-ip-addresses", title: "Restore Valid IP Addresses", difficulty: "medium" },
      { id: "subsets-with-duplicates", title: "All Subsets With Duplicates Allowed", difficulty: "medium" },
      { id: "subsets-without-duplicates", title: "All Subsets of Distinct Elements", difficulty: "easy" },
    ],
  },
  {
    slug: "binary-search",
    label: "Binary Search",
    problems: [
      { id: "find-min-in-rotated", title: "Find Minimum in Rotated Array", difficulty: "medium" },
      { id: "find-peak-element", title: "Find Peak Element", difficulty: "medium" },
      { id: "first-and-last-position", title: "First and Last Position of Target", difficulty: "medium" },
      { id: "index-in-sorted", title: "Locate Index in Sorted Array", difficulty: "easy" },
      { id: "integer-square-root", title: "Integer Square Root", difficulty: "easy" },
      { id: "kokos-min-eating-speed", title: "Koko's Minimum Eating Speed", difficulty: "hard" },
      { id: "next-greatest-letter", title: "Next Greatest Letter", difficulty: "easy" },
      { id: "search-in-2d-matrix", title: "Search in 2D Matrix", difficulty: "medium" },
      { id: "search-in-rotated", title: "Search in Rotated Sorted Array", difficulty: "medium" },
      { id: "search-insert-position", title: "Search Insert Position", difficulty: "easy" },
    ],
  },
  {
    slug: "dynamic-programming",
    label: "Dynamic Programming",
    problems: [
      { id: "burst-balloons-max-coins", title: "Max Coins from Bursting Balloons", difficulty: "hard" },
      { id: "climb-stairs-ways", title: "Ways to Climb a Staircase", difficulty: "easy" },
      { id: "coin-change-min", title: "Minimum Coins to Make Amount", difficulty: "medium" },
      { id: "coin-change-ways", title: "Number of Ways to Make Amount", difficulty: "medium" },
      { id: "decode-ways-count", title: "Number of Ways to Decode", difficulty: "medium" },
      { id: "delete-and-earn", title: "Delete and Earn Points", difficulty: "medium" },
      { id: "distinct-subsequence-count", title: "Count Distinct Subsequences", difficulty: "hard" },
      { id: "edit-distance-min", title: "Minimum Edit Distance", difficulty: "hard" },
      { id: "grid-min-path-sum", title: "Minimum Cost Path in a Grid", difficulty: "medium" },
      { id: "grid-unique-paths-with-blocks", title: "Unique Paths in a Blocked Grid", difficulty: "medium" },
      { id: "house-robber-circle", title: "House Robber on a Ring", difficulty: "medium" },
      { id: "house-robber-linear", title: "House Robber on a Street", difficulty: "medium" },
      { id: "interleaving-string-check", title: "Check Interleaving of Two Strings", difficulty: "medium" },
      { id: "lcs-length", title: "Longest Common Subsequence Length", difficulty: "medium" },
      { id: "lis-length", title: "Length of Longest Increasing Subsequence", difficulty: "medium" },
      { id: "longest-palindromic-subsequence", title: "Longest Palindromic Subsequence Length", difficulty: "medium" },
      { id: "max-subarray-sum", title: "Maximum Subarray Sum", difficulty: "easy" },
      { id: "maximal-square-area", title: "Largest Square of Ones", difficulty: "medium" },
      { id: "min-cost-stairs", title: "Minimum Cost to Reach the Top", difficulty: "easy" },
      { id: "minimum-perfect-squares", title: "Fewest Perfect Squares to Sum", difficulty: "medium" },
      { id: "paint-fence-two-colors", title: "Ways to Paint Fence with No 3 Adjacent Same", difficulty: "medium" },
      { id: "palindrome-partition-min-cut", title: "Minimum Cuts for Palindrome Partitioning", difficulty: "hard" },
      { id: "partition-equal-subset-sum", title: "Can Partition into Equal Sum Subsets", difficulty: "medium" },
      { id: "regular-expression-matching", title: "Regex Matching with '.' and '*'", difficulty: "hard" },
      { id: "rod-cutting-max-value", title: "Max Value Rod Cutting", difficulty: "medium" },
      { id: "wildcard-matching-glob", title: "Wildcard Pattern Matching", difficulty: "hard" },
      { id: "word-break-check", title: "Segment String into Dictionary Words", difficulty: "medium" },
    ],
  },
  {
    slug: "graphs",
    label: "Graphs",
    problems: [
      { id: "cheapest-flights-with-k-stops", title: "Cheapest Flight with Stop Limit", difficulty: "medium" },
      { id: "check-graph-bipartite", title: "Check if a Graph is Bipartite", difficulty: "medium" },
      { id: "clone-undirected-graph", title: "Clone an Undirected Graph", difficulty: "medium" },
      { id: "connect-points-min-cost", title: "Connect All Points with Minimum Cost", difficulty: "medium" },
      { id: "count-islands-in-grid", title: "Count Landmasses in a Grid", difficulty: "medium" },
      { id: "count-provinces", title: "Count Provinces from Friendship Matrix", difficulty: "medium" },
      { id: "course-ordering", title: "Build a Valid Course Order", difficulty: "medium" },
      { id: "course-plan-feasible", title: "Course Plan Feasibility", difficulty: "medium" },
      { id: "detect-cycle-directed", title: "Detect a Cycle in a Directed Graph", difficulty: "medium" },
      { id: "evaluate-division-ratios", title: "Evaluate Division Equations via Graph", difficulty: "medium" },
      { id: "find-city-threshold-distance", title: "Find City With Fewest Neighbors Within Threshold", difficulty: "medium" },
      { id: "min-cost-with-highway-pass", title: "Minimum Toll with Freeways and Tolls", difficulty: "hard" },
      { id: "minimum-height-trees-centers", title: "Centers of a Tree (Minimum Height Trees)", difficulty: "medium" },
      { id: "mst-kruskal-total-cost", title: "Minimum Spanning Tree by Kruskal", difficulty: "medium" },
      { id: "network-broadcast-time", title: "Network Broadcast Time from a Source", difficulty: "medium" },
      { id: "num-enclaves", title: "Number of Enclaves (Land Trapped by Sea)", difficulty: "medium" },
      { id: "pacific-atlantic-flow", title: "Cells Flowing to Both Oceans", difficulty: "medium" },
      { id: "path-with-minimum-effort", title: "Path with Minimum Effort in a Grid", difficulty: "medium" },
      { id: "redundant-connection-undirected", title: "Find the Redundant Connection", difficulty: "medium" },
      { id: "rotting-oranges-min-time", title: "Minimum Time to Rot All Oranges", difficulty: "medium" },
      { id: "shortest-path-binary-matrix", title: "Shortest Path in a Binary Matrix", difficulty: "medium" },
      { id: "swim-in-rising-water", title: "Earliest Time to Swim Across Rising Water", difficulty: "hard" },
      { id: "word-ladder-length", title: "Shortest Transformation Ladder Length", difficulty: "hard" },
    ],
  },
  {
    slug: "greedy",
    label: "Greedy",
    problems: [
      { id: "assign-cookies-to-children", title: "Maximize Content Children with Cookies", difficulty: "easy" },
      { id: "burst-balloons-min-arrows", title: "Minimum Arrows to Burst All Balloons", difficulty: "medium" },
      { id: "gas-station-tour", title: "Complete a Circuit on Gas Stations", difficulty: "medium" },
      { id: "lemonade-change-cashier", title: "Lemonade Stand Change Validator", difficulty: "easy" },
      { id: "min-jumps-to-end", title: "Fewest Jumps to Reach the End", difficulty: "medium" },
      { id: "partition-labels-slices", title: "Partition String into Independent Slices", difficulty: "medium" },
      { id: "reconstruct-line-by-height", title: "Reconstruct Line by Height and K-Count", difficulty: "medium" },
      { id: "schedule-max-compatible", title: "Schedule Maximum Compatible Meetings", difficulty: "medium" },
    ],
  },
  {
    slug: "heaps",
    label: "Heaps",
    problems: [
      { id: "k-closest-points", title: "K Closest Points to the Origin", difficulty: "medium" },
      { id: "kth-largest-in-array", title: "Find the K-th Largest Value", difficulty: "medium" },
      { id: "median-from-data-stream", title: "Maintain the Median of a Data Stream", difficulty: "hard" },
      { id: "merge-k-sorted-lists", title: "Merge K Sorted Linked Lists", difficulty: "hard" },
      { id: "minimum-meeting-rooms", title: "Minimum Meeting Rooms", difficulty: "medium" },
      { id: "reorganize-string-no-adjacent", title: "Reorganize String to Avoid Adjacent Duplicates", difficulty: "medium" },
      { id: "task-scheduler-with-cooldown", title: "Task Scheduler with Cooldown", difficulty: "medium" },
      { id: "top-k-frequent-elements", title: "Top-K Frequent Elements", difficulty: "medium" },
    ],
  },
  {
    slug: "intervals",
    label: "Intervals",
    problems: [
      { id: "employee-common-free-time", title: "Find Common Free Time of Employees", difficulty: "hard" },
      { id: "erase-min-overlaps", title: "Remove Fewest Intervals to Avoid Overlaps", difficulty: "medium" },
      { id: "insert-interval-position", title: "Insert and Merge a Time Block", difficulty: "medium" },
      { id: "interval-list-intersection", title: "Intersect Two Schedules", difficulty: "medium" },
      { id: "merge-intervals-consolidate", title: "Consolidate Overlapping Time Blocks", difficulty: "medium" },
      { id: "min-meeting-rooms-needed", title: "Minimum Rooms to Host All Meetings", difficulty: "medium" },
    ],
  },
  {
    slug: "linked-lists",
    label: "Linked Lists",
    problems: [
      { id: "add-two-numbers", title: "Add Two Numbers as Lists", difficulty: "medium" },
      { id: "copy-list-with-random-pointer", title: "Copy List with Random Pointer", difficulty: "medium" },
      { id: "cycle-start-node", title: "Find Cycle Start Node", difficulty: "medium" },
      { id: "detect-cycle-in-list", title: "Detect Cycle in List", difficulty: "easy" },
      { id: "intersection-of-two-lists", title: "Intersection of Two Lists", difficulty: "easy" },
      { id: "merge-two-sorted-lists", title: "Merge Two Sorted Lists", difficulty: "easy" },
      { id: "partition-linked-list", title: "Partition Linked List", difficulty: "medium" },
      { id: "remove-nth-from-end", title: "Remove Nth From End", difficulty: "medium" },
      { id: "reorder-linked-list", title: "Reorder Linked List", difficulty: "medium" },
      { id: "reverse-linked-list", title: "Reverse a Linked List", difficulty: "easy" },
      { id: "reverse-nodes-in-k-group", title: "Reverse Nodes in k-Group", difficulty: "hard" },
      { id: "rotate-linked-list", title: "Rotate Linked List", difficulty: "medium" },
      { id: "sort-linked-list", title: "Sort Linked List", difficulty: "medium" },
    ],
  },
  {
    slug: "math-geometry",
    label: "Math & Geometry",
    problems: [
      { id: "count-primes-sieve", title: "Count Primes Below N", difficulty: "easy" },
      { id: "erect-the-fence-convex-hull", title: "Compute Convex Hull of Points", difficulty: "hard" },
      { id: "fast-power-exponent", title: "Power Function with Fast Exponentiation", difficulty: "medium" },
      { id: "fraction-to-decimal-string", title: "Convert Fraction to Recurring Decimal", difficulty: "medium" },
      { id: "integer-sqrt-floor", title: "Floor of Square Root", difficulty: "easy" },
      { id: "max-points-collinear", title: "Maximum Collinear Points", difficulty: "hard" },
      { id: "rectangle-union-area", title: "Area of Union of Two Rectangles", difficulty: "medium" },
      { id: "valid-triangle-count", title: "Count Valid Triangles in Array", difficulty: "medium" },
    ],
  },
  {
    slug: "sliding-window",
    label: "Sliding Window",
    problems: [
      { id: "all-anagram-start-indices", title: "All Anagram Start Indices", difficulty: "medium" },
      { id: "collecting-two-types", title: "Collecting Two Types", difficulty: "medium" },
      { id: "contains-permutation", title: "String Contains Scrambled Pattern", difficulty: "medium" },
      { id: "longest-ones-after-flips", title: "Longest Ones After Flips", difficulty: "medium" },
      { id: "longest-window-without-repeats", title: "Longest Window Without Repeats", difficulty: "medium" },
      { id: "max-sum-window-of-size-k", title: "Max Sum Window of Size K", difficulty: "easy" },
      { id: "smallest-window-with-target-sum", title: "Smallest Window With Target Sum", difficulty: "medium" },
      { id: "subarrays-with-exactly-k-distinct", title: "Subarrays With Exactly K Distinct", difficulty: "hard" },
    ],
  },
  {
    slug: "trees",
    label: "Trees",
    problems: [
      { id: "balanced-binary-tree", title: "Check if a Binary Tree is Height-Balanced", difficulty: "easy" },
      { id: "build-from-preorder-inorder", title: "Construct Tree from Preorder and Inorder", difficulty: "medium" },
      { id: "diameter-of-binary-tree", title: "Diameter of a Binary Tree", difficulty: "medium" },
      { id: "inorder-traversal-iterative", title: "Iterative Inorder Traversal", difficulty: "easy" },
      { id: "invert-binary-tree", title: "Invert Binary Tree", difficulty: "easy" },
      { id: "kth-smallest-in-bst", title: "Kth Smallest in BST", difficulty: "medium" },
      { id: "level-order-traversal", title: "Level Order Traversal", difficulty: "medium" },
      { id: "lowest-common-ancestor-bst", title: "Lowest Common Ancestor in BST", difficulty: "medium" },
      { id: "lowest-common-ancestor-bt", title: "Lowest Common Ancestor in a Binary Tree", difficulty: "medium" },
      { id: "maximum-depth-of-tree", title: "Maximum Depth of a Tree", difficulty: "easy" },
      { id: "path-sum-equals-target", title: "Root-to-Leaf Path Sum", difficulty: "easy" },
      { id: "recover-bst", title: "Recover a Swapped Binary Search Tree", difficulty: "hard" },
      { id: "right-side-view", title: "Right Side View", difficulty: "medium" },
      { id: "same-tree-check", title: "Check if Two Trees are Identical", difficulty: "easy" },
      { id: "serialize-deserialize-binary-tree", title: "Serialize and Deserialize a Binary Tree", difficulty: "hard" },
      { id: "subtree-of-another", title: "Subtree of Another Tree", difficulty: "medium" },
      { id: "validate-bst", title: "Validate a Binary Search Tree", difficulty: "medium" },
      { id: "zigzag-level-order-traversal", title: "Zigzag Level Order Traversal", difficulty: "medium" },
    ],
  },
  {
    slug: "tries",
    label: "Tries",
    problems: [
      { id: "add-and-search-words", title: "Add and Search with '.' Wildcards", difficulty: "medium" },
      { id: "autocomplete-top-k", title: "Autocomplete with Top-K Frequent Suggestions", difficulty: "hard" },
      { id: "implement-prefix-dictionary", title: "Implement a Prefix Dictionary", difficulty: "easy" },
      { id: "longest-buildable-word", title: "Longest Word Buildable by Successive Prefixes", difficulty: "medium" },
      { id: "replace-words-using-dictionary", title: "Replace Words Using a Dictionary of Roots", difficulty: "medium" },
    ],
  },
  {
    slug: "two-pointers",
    label: "Two Pointers",
    problems: [
      { id: "almost-palindrome", title: "Almost Palindrome", difficulty: "medium" },
      { id: "closest-triplet-sum", title: "Closest Triplet Sum", difficulty: "medium" },
      { id: "compress-sorted-stream", title: "Compress Sorted Stream", difficulty: "easy" },
      { id: "neutral-triplet-sum", title: "Neutral Triplet Sum", difficulty: "medium" },
      { id: "pair-with-target-in-sorted", title: "Pair Indices for Target in Sorted Array", difficulty: "easy" },
      { id: "sorted-squares-rebuilder", title: "Sorted Squares Rebuilder", difficulty: "easy" },
      { id: "stable-zero-push", title: "Stable Zero Push", difficulty: "easy" },
      { id: "target-quadruplets", title: "Target Quadruplets", difficulty: "medium" },
      { id: "vowel-mirror", title: "Vowel Mirror", difficulty: "easy" },
      { id: "widest-water-reservoir", title: "Widest Water Reservoir", difficulty: "medium" },
    ],
  },
];

/* ── All categories ───────────────────────────────────── */

export const categories: Category[] = [
  {
    slug: "frontend",
    label: "Frontend",
    description: "React components, hooks, CSS layouts, accessibility, state management, and performance challenges.",
    icon: "Monitor",
    problemCount: frontendSubs.reduce((n, s) => n + s.problems.length, 0),
    subCategories: frontendSubs,
  },
  {
    slug: "leetcode",
    label: "LeetCode",
    description: "Classic algorithm and data-structure problems — arrays, trees, graphs, DP, and more.",
    icon: "Code",
    problemCount: leetcodeSubs.reduce((n, s) => n + s.problems.length, 0),
    subCategories: leetcodeSubs,
  },
  {
    slug: "backend",
    label: "Backend",
    description: "API design, authentication, middleware, database integration, and server-side patterns.",
    icon: "Server",
    problemCount: 0,
    subCategories: [],
  },
  {
    slug: "database",
    label: "Database",
    description: "SQL queries, schema design, migrations, indexing, and data modelling challenges.",
    icon: "Database",
    problemCount: 0,
    subCategories: [],
  },
];

/** Look up a single category by its slug. */
export function getCategoryBySlug(slug: string): Category | undefined {
  return categories.find((c) => c.slug === slug);
}
