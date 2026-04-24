import { formatCost } from "@ccflare/core";
import type { TimeRange } from "@ccflare/types";
import { formatNumber } from "@ccflare/ui";
import { Users } from "lucide-react";
import { useSpendingByUser } from "../../hooks/queries";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "../ui/card";

interface Props {
	timeRange: TimeRange;
}

/**
 * Per-user spending card. Renders only when the per-user access-keys
 * feature is enabled AND at least one user has logged a tagged request
 * in the selected time range. When the feature is off or nobody has
 * spent anything yet, the hook returns users: [] and we render nothing
 * (parent can still show the rest of OverviewTab byte-identical to
 * pre-Phase-3 behavior).
 */
export function SpendingByUserCard({ timeRange }: Props) {
	const { data, isLoading } = useSpendingByUser(timeRange);
	const users = data?.users ?? [];

	if (isLoading || users.length === 0) {
		return null;
	}

	const totalCost = users.reduce((sum, u) => sum + u.costUsd, 0);
	const totalRequests = users.reduce((sum, u) => sum + u.requestCount, 0);

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-lg">
					<Users className="h-5 w-5" />
					Spending by user
				</CardTitle>
				<CardDescription>
					Cost and request attribution across the selected time range.
					Requests without a tagged user are excluded.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="space-y-2">
					{users.map((user) => {
						const costPct =
							totalCost > 0 ? (user.costUsd / totalCost) * 100 : 0;
						return (
							<div
								key={user.userId}
								className="flex items-center justify-between py-2 border-b last:border-0"
							>
								<div className="flex-1">
									<div className="font-medium text-sm">
										{user.userName ?? user.userId.slice(0, 8)}
									</div>
									<div className="text-xs text-muted-foreground">
										{formatNumber(user.requestCount)} requests
									</div>
								</div>
								<div className="text-right">
									<div className="font-medium text-sm">
										{formatCost(user.costUsd)}
									</div>
									<div className="text-xs text-muted-foreground">
										{costPct.toFixed(1)}%
									</div>
								</div>
							</div>
						);
					})}
					<div className="flex items-center justify-between pt-3 text-sm font-medium">
						<span>Total</span>
						<span>
							{formatCost(totalCost)} · {formatNumber(totalRequests)} reqs
						</span>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
