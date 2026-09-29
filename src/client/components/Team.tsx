import { textOn } from '../../shared/teams';
import type { Team } from '../../shared/types';

export function TeamBadge({ team, size = 'md' }: { team: Team | undefined; size?: 'sm' | 'md' | 'lg' }) {
  if (!team) return <span className={`badge badge-${size} badge-empty`}>?</span>;
  return (
    <span className={`badge badge-${size}`} style={{ background: team.color, color: textOn(team.color) }} title={team.name}>
      {team.abbr}
    </span>
  );
}

export function TeamLabel({ team, full }: { team: Team | undefined; full?: boolean }) {
  return (
    <span className="team-label">
      <TeamBadge team={team} size="sm" />
      <span>{team ? (full ? team.name : team.short) : 'TBD'}</span>
    </span>
  );
}
