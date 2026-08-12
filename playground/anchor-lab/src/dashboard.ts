// A dashboard worth annotating. Every element carries data-steer-loc exactly as
// the dev-only JSX transform would emit it, so layered v2 has real source
// evidence to narrow on. `state` exists so the Shuffle button can put the page
// through structural change, not just resizing.

export interface DashState {
  /** Swaps the whole dataset: values, account names, activity copy. */
  dataset: 0 | 1
  showActivity: boolean
  extraRow: boolean
  /** Simulates someone editing the file above these elements. */
  lineShift: number
}

export const INITIAL: DashState = { dataset: 0, showActivity: true, extraRow: false, lineShift: 0 }

const FILES = {
  page: "src/pages/Revenue.tsx",
  tile: "src/components/StatTile.tsx",
  table: "src/components/AccountTable.tsx",
}

type FileKey = keyof typeof FILES

interface O {
  f?: FileKey
  line?: number
  col?: number
  id?: string
  testid?: string
  cls?: string
  text?: string
  /** Seeding hook only. Never read during resolution. */
  demo?: string
}

const DATA = [
  {
    kpis: [
      { label: "Monthly recurring", value: "$412,880", delta: "+6.2%", dir: "up" },
      { label: "Active accounts", value: "1,284", delta: "+41", dir: "up" },
      { label: "Net churn", value: "2.1%", delta: "+0.4pt", dir: "down" },
      { label: "Expansion", value: "$38,410", delta: "+11.8%", dir: "up" },
    ],
    series: [28, 34, 31, 42, 39, 51, 48, 60, 57, 68, 72, 81],
    accounts: [
      ["Northwind Traders", "Enterprise", "$48,200"],
      ["Contoso Group", "Enterprise", "$41,650"],
      ["Fabrikam Industries", "Team", "$27,900"],
      ["Tailspin Toys", "Team", "$19,440"],
      ["Wingtip Systems", "Starter", "$8,120"],
    ],
    activity: [
      ["Contoso Group", "upgraded to Enterprise"],
      ["Tailspin Toys", "added 12 seats"],
      ["Wingtip Systems", "invoice paid"],
      ["Fabrikam Industries", "renewal in 9 days"],
    ],
  },
  {
    kpis: [
      { label: "Monthly recurring", value: "$438,110", delta: "+6.1%", dir: "up" },
      { label: "Active accounts", value: "1,331", delta: "+47", dir: "up" },
      { label: "Net churn", value: "1.8%", delta: "-0.3pt", dir: "up" },
      { label: "Expansion", value: "$44,020", delta: "+14.6%", dir: "up" },
    ],
    series: [34, 31, 42, 39, 51, 48, 60, 57, 68, 72, 81, 88],
    accounts: [
      ["Contoso Group", "Enterprise", "$52,300"],
      ["Northwind Traders", "Enterprise", "$47,880"],
      ["Tailspin Toys", "Team", "$24,110"],
      ["Fabrikam Industries", "Team", "$22,760"],
      ["Wingtip Systems", "Starter", "$9,430"],
    ],
    activity: [
      ["Northwind Traders", "seat true-up applied"],
      ["Contoso Group", "renewal signed"],
      ["Tailspin Toys", "upgraded to Team"],
      ["Wingtip Systems", "card expiring"],
    ],
  },
]

function sparkline(series: number[]): SVGSVGElement {
  const w = 100
  const h = 34
  const max = Math.max(...series)
  const min = Math.min(...series)
  const pts = series.map((v, i) => {
    const x = (i / (series.length - 1)) * w
    const y = h - ((v - min) / (max - min || 1)) * (h - 4) - 2
    return `${x.toFixed(2)},${y.toFixed(2)}`
  })
  const ns = "http://www.w3.org/2000/svg"
  const svg = document.createElementNS(ns, "svg")
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`)
  svg.setAttribute("preserveAspectRatio", "none")
  svg.setAttribute("class", "spark")
  const area = document.createElementNS(ns, "path")
  area.setAttribute("d", `M0,${h} L${pts.join(" L")} L${w},${h} Z`)
  area.setAttribute("class", "spark-area")
  const line = document.createElementNS(ns, "polyline")
  line.setAttribute("points", pts.join(" "))
  line.setAttribute("class", "spark-line")
  svg.append(area, line)
  return svg
}

export function renderDashboard(host: Element, s: DashState): void {
  const d = DATA[s.dataset]

  function el(tag: string, o: O = {}, kids: (Node | string)[] = []): HTMLElement {
    const n = document.createElement(tag)
    if (o.f && o.line != null) {
      n.setAttribute("data-steer-loc", `${FILES[o.f]}:${o.line + s.lineShift}:${o.col ?? 4}`)
    }
    if (o.id) n.id = o.id
    if (o.testid) n.setAttribute("data-testid", o.testid)
    if (o.demo) n.setAttribute("data-demo-id", o.demo)
    if (o.cls) n.className = o.cls
    if (o.text) n.append(document.createTextNode(o.text))
    for (const k of kids) n.append(k)
    return n
  }

  const sidebar = el("aside", { f: "page", line: 14, cls: "side" }, [
    el("div", { f: "page", line: 15, cls: "brand" }, [
      el("span", { cls: "dot" }),
      el("span", { cls: "brand-name", text: "Meridian" }),
    ]),
    el(
      "nav",
      { f: "page", line: 19, cls: "side-nav" },
      ["Overview", "Revenue", "Customers", "Retention", "Settings"].map((label, i) =>
        el("a", {
          f: "page",
          line: 20,
          col: 8,
          id: `nav-${label.toLowerCase()}`,
          cls: `side-link${i === 1 ? " on" : ""}`,
          text: label,
        }),
      ),
    ),
  ])

  const topbar = el("header", { f: "page", line: 28, cls: "top" }, [
    el("h1", { f: "page", line: 29, id: "page-title", cls: "top-title", text: "Revenue" }),
    el("div", { f: "page", line: 30, cls: "top-right" }, [
      el("span", { f: "page", line: 31, cls: "chip", text: "Last 12 months" }),
      el("span", { f: "page", line: 32, cls: "avatar", text: "AC" }),
    ]),
  ])

  const kpis = el(
    "section",
    { f: "page", line: 38, cls: "kpis" },
    d.kpis.map((k, i) =>
      // One source line, four tiles. The case that breaks naive matching.
      el("div", { f: "tile", line: 9, col: 4, cls: "tile" }, [
        el("span", {
          f: "tile",
          line: 10,
          col: 6,
          cls: "tile-label",
          text: k.label,
          demo: i === 0 ? "kpi-label" : undefined,
        }),
        el("strong", {
          f: "tile",
          line: 11,
          col: 6,
          cls: "tile-value",
          text: k.value,
          demo: i === 0 ? "kpi-value" : undefined,
        }),
        el("span", {
          f: "tile",
          line: 12,
          col: 6,
          cls: `tile-delta ${k.dir}`,
          text: k.delta,
          demo: i === 2 ? "churn-delta" : undefined,
        }),
      ]),
    ),
  )

  const chart = el("section", { f: "page", line: 46, cls: "card chart" }, [
    el("div", { f: "page", line: 47, cls: "card-hd" }, [
      el("h2", { f: "page", line: 48, cls: "card-title", text: "Recurring revenue" }),
      el("div", { f: "page", line: 49, cls: "legend", demo: "legend" }, [
        el("span", { cls: "key key-a" }, [el("i"), "Booked"]),
        el("span", { cls: "key key-b" }, [el("i"), "Forecast"]),
      ]),
    ]),
    el("div", { f: "page", line: 54, cls: "chart-body" }, [sparkline(d.series)]),
  ])

  const rows = [...d.accounts]
  if (s.extraRow) rows.unshift(["Adventure Works", "Enterprise", "$61,040"])

  const table = el("section", { f: "page", line: 60, cls: "card" }, [
    el("div", { f: "page", line: 61, cls: "card-hd" }, [
      el("h2", { f: "page", line: 62, cls: "card-title", text: "Top accounts" }),
      el("a", { f: "page", line: 63, cls: "link", text: "View all" }),
    ]),
    el(
      "div",
      { f: "table", line: 7, cls: "tbl-body" },
      rows.map(([name, plan, amt], i) =>
        el("div", { f: "table", line: 8, col: 6, cls: "trow" }, [
          el("span", { f: "table", line: 9, col: 8, cls: "tname", text: name }),
          el("span", { f: "table", line: 10, col: 8, cls: "tplan", text: plan }),
          el("span", {
            f: "table",
            line: 11,
            col: 8,
            cls: "tamt",
            text: amt,
            demo: i === 0 ? "top-amount" : undefined,
          }),
        ]),
      ),
    ),
  ])

  const panels: Node[] = [table]
  if (s.showActivity) {
    panels.push(
      el("section", { f: "page", line: 70, cls: "card" }, [
        el("div", { f: "page", line: 71, cls: "card-hd" }, [
          el("h2", { f: "page", line: 72, cls: "card-title", text: "Recent activity" }),
        ]),
        el(
          "ul",
          { f: "page", line: 75, cls: "acts" },
          d.activity.map(([who, what]) =>
            el("li", { f: "page", line: 76, col: 8, cls: "act" }, [
              el("b", { cls: "act-who", text: who }),
              el("span", { cls: "act-what", text: what }),
            ]),
          ),
        ),
      ]),
    )
  }

  const main = el("main", { f: "page", line: 36, cls: "main" }, [
    topbar,
    kpis,
    chart,
    el("div", { f: "page", line: 58, cls: "split" }, panels),
    el("footer", { f: "page", line: 84, cls: "foot" }, [
      el("p", {
        f: "page",
        line: 85,
        cls: "foot-note",
        text: "Figures update nightly at 02:00 UTC. Forecast excludes unbilled expansion.",
        demo: "foot-note",
      }),
    ]),
  ])

  host.replaceChildren(sidebar, main)
}
