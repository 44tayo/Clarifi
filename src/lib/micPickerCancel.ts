/**
 * When New meeting (or a newly created calendar meeting) opens the mic picker
 * and the user dismisses it without starting, discard that draft so it never
 * appears as a meeting in the list.
 */
export function takeDiscardMeetingOnMicCancel(
  discardMeetingId: string | null,
): { deleteId: string | null } {
  return { deleteId: discardMeetingId }
}
