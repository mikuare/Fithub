import { useLocation } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/States';
import { Card } from '@/components/ui/Card';

export default function NotFound() {
  const location = useLocation();
  return (
    <div className="max-w-lg mx-auto py-10">
      <Card>
        <EmptyState
          icon={<Compass size={22} />}
          title="That page does not exist"
          body={`Nothing is routed at ${location.pathname}. It may have moved, or the link may be out of date.`}
          action={<Button to="/">Back to dashboard</Button>}
          secondary={<Button variant="outline" to="/exercises">Browse exercises</Button>}
        />
      </Card>
    </div>
  );
}
