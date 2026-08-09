import { Link } from "react-router"
import { Button } from "../components/Button"
import { Badge } from "../components/Badge"
import { Input } from "../components/Input"
import { Card } from "../components/Card"
import { Alert } from "../components/Alert"

/** A small fake product page so components have real usage sites. */
export function DemoPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">Acme Console (React)</h1>
          <Badge tone="success" dot>
            Live
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm">
            Docs
          </Button>
          <Button variant="primary" size="sm">
            New project
          </Button>
        </div>
      </header>

      <Alert tone="info" title="Scheduled maintenance" dismissable>
        The console will be read-only on Sunday from 02:00 to 03:00 UTC.
      </Alert>

      <div className="mt-6 grid grid-cols-2 gap-6">
        <Card title="Invite a teammate" footer="Invites expire after 7 days">
          <div className="flex flex-col gap-4">
            <Input label="Email" placeholder="teammate@acme.com" />
            <Card.Actions align="right">
              <Button variant="secondary" size="sm">
                Send invite
              </Button>
            </Card.Actions>
          </div>
        </Card>

        <Card title="Danger zone">
          <div className="flex flex-col gap-3">
            <p className="text-sm text-zinc-600">
              Deleting a project is permanent and removes all associated data.
            </p>
            <div>
              <Button variant="destructive" size="sm">
                Delete project
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <p className="mt-12 text-sm text-zinc-500">
        This is the fake product. The interesting part is the{" "}
        <Link
          to="/__steer"
          className="cursor-pointer font-medium text-indigo-600 hover:text-indigo-800"
        >
          steer
        </Link>
        .
      </p>
    </div>
  )
}
