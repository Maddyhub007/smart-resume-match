-- Allow participants to update conversations (for last_message_at)
CREATE POLICY "Participants update conversations"
ON public.conversations
FOR UPDATE
USING ((auth.uid() = recruiter_id) OR (auth.uid() = candidate_id));