-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(32) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "elo_rating" INTEGER NOT NULL DEFAULT 1000,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "debates_completed" INTEGER NOT NULL DEFAULT 0,
    "avatar" VARCHAR(255) DEFAULT 'default',
    "rank_tier" VARCHAR(32) DEFAULT 'Unranked',
    "online_status" VARCHAR(16) DEFAULT 'offline',
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "is_banned" BOOLEAN NOT NULL DEFAULT false,
    "is_bot" BOOLEAN NOT NULL DEFAULT false,
    "owner_id" INTEGER,
    "api_key" VARCHAR(64),
    "bot_description" VARCHAR(280),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "username_changes" VARCHAR(512) NOT NULL DEFAULT '',

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debates" (
    "id" SERIAL NOT NULL,
    "topic" VARCHAR(255) NOT NULL,
    "category" VARCHAR(64) DEFAULT 'Society',
    "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
    "player1_id" INTEGER,
    "player2_id" INTEGER,
    "winner_id" INTEGER,
    "side_player1" VARCHAR(16) DEFAULT 'FOR',
    "side_player2" VARCHAR(16) DEFAULT 'AGAINST',
    "current_round" INTEGER DEFAULT 0,
    "current_turn_user_id" INTEGER,
    "phase" VARCHAR(32) DEFAULT 'opening',
    "is_prep" BOOLEAN NOT NULL DEFAULT false,
    "turn_started_at" TIMESTAMP(3),
    "turn_deadline" TIMESTAMP(3),
    "score_player1" DOUBLE PRECISION DEFAULT 0,
    "score_player2" DOUBLE PRECISION DEFAULT 0,
    "ai_score_player1" DOUBLE PRECISION DEFAULT 0,
    "ai_score_player2" DOUBLE PRECISION DEFAULT 0,
    "votes_player1" INTEGER DEFAULT 0,
    "votes_player2" INTEGER DEFAULT 0,
    "elo_delta_player1" INTEGER DEFAULT 0,
    "elo_delta_player2" INTEGER DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "debates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debate_messages" (
    "id" SERIAL NOT NULL,
    "debate_id" INTEGER NOT NULL,
    "author_id" INTEGER,
    "round_number" INTEGER NOT NULL,
    "phase" VARCHAR(32) NOT NULL,
    "content" TEXT NOT NULL,
    "word_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debate_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debate_votes" (
    "id" SERIAL NOT NULL,
    "debate_id" INTEGER NOT NULL,
    "voter_id" INTEGER NOT NULL,
    "vote_for" INTEGER,
    "voter_ip_hash" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debate_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debate_results" (
    "id" SERIAL NOT NULL,
    "debate_id" INTEGER NOT NULL,
    "winner_id" INTEGER,
    "loser_id" INTEGER,
    "final_score_player1" DOUBLE PRECISION DEFAULT 0,
    "final_score_player2" DOUBLE PRECISION DEFAULT 0,
    "ai_score_player1" DOUBLE PRECISION DEFAULT 0,
    "ai_score_player2" DOUBLE PRECISION DEFAULT 0,
    "votes_player1" INTEGER DEFAULT 0,
    "votes_player2" INTEGER DEFAULT 0,
    "elo_change_winner" INTEGER DEFAULT 0,
    "elo_change_loser" INTEGER DEFAULT 0,
    "summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debate_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matchmaking_queue" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "preferred_topic" VARCHAR(255),
    "preferred_category" VARCHAR(64),
    "elo_snapshot" INTEGER DEFAULT 1000,
    "socket_sid" VARCHAR(64),
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matchmaking_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_stats" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "peak_elo" INTEGER DEFAULT 1000,
    "avg_words_per_argument" DOUBLE PRECISION DEFAULT 0,
    "longest_win_streak" INTEGER DEFAULT 0,
    "current_streak" INTEGER DEFAULT 0,
    "total_arguments" INTEGER DEFAULT 0,
    "total_audience_votes" INTEGER DEFAULT 0,
    "favorite_category" VARCHAR(64),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "key" VARCHAR(64) NOT NULL,
    "value" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "achievements" (
    "code" VARCHAR(48) NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "icon" VARCHAR(8) DEFAULT '★',
    "tier" VARCHAR(16) DEFAULT 'bronze',

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "user_achievements" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "code" VARCHAR(48) NOT NULL,
    "awarded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "debate_id" INTEGER,

    CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" SERIAL NOT NULL,
    "reporter_id" INTEGER,
    "target_user_id" INTEGER,
    "debate_id" INTEGER,
    "message_id" INTEGER,
    "reason" VARCHAR(32) DEFAULT 'other',
    "note" TEXT,
    "status" VARCHAR(16) NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenges" (
    "id" SERIAL NOT NULL,
    "challenger_id" INTEGER NOT NULL,
    "target_id" INTEGER NOT NULL,
    "topic" VARCHAR(255) NOT NULL,
    "category" VARCHAR(64) DEFAULT 'Society',
    "note" TEXT,
    "status" VARCHAR(16) NOT NULL DEFAULT 'pending',
    "debate_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),

    CONSTRAINT "challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "friendships" (
    "id" SERIAL NOT NULL,
    "requester_id" INTEGER NOT NULL,
    "target_id" INTEGER NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMP(3),

    CONSTRAINT "friendships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" BIGSERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "kind" VARCHAR(64) NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "user_id" INTEGER NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "user_blocks" (
    "blocker_id" INTEGER NOT NULL,
    "blocked_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("blocker_id","blocked_id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" BIGSERIAL NOT NULL,
    "actor_id" INTEGER,
    "kind" VARCHAR(64) NOT NULL,
    "target_id" BIGINT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ip" VARCHAR(64),
    "user_agent" VARCHAR(256),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_api_key_key" ON "users"("api_key");

-- CreateIndex
CREATE INDEX "users_username_idx" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_is_bot_idx" ON "users"("is_bot");

-- CreateIndex
CREATE INDEX "users_api_key_idx" ON "users"("api_key");

-- CreateIndex
CREATE INDEX "debates_status_idx" ON "debates"("status");

-- CreateIndex
CREATE INDEX "debates_player1_id_idx" ON "debates"("player1_id");

-- CreateIndex
CREATE INDEX "debates_player2_id_idx" ON "debates"("player2_id");

-- CreateIndex
CREATE INDEX "debate_messages_debate_id_idx" ON "debate_messages"("debate_id");

-- CreateIndex
CREATE INDEX "debate_votes_debate_id_idx" ON "debate_votes"("debate_id");

-- CreateIndex
CREATE INDEX "debate_votes_voter_id_idx" ON "debate_votes"("voter_id");

-- CreateIndex
CREATE INDEX "debate_votes_voter_ip_hash_idx" ON "debate_votes"("voter_ip_hash");

-- CreateIndex
CREATE UNIQUE INDEX "debate_votes_debate_id_voter_id_key" ON "debate_votes"("debate_id", "voter_id");

-- CreateIndex
CREATE UNIQUE INDEX "debate_results_debate_id_key" ON "debate_results"("debate_id");

-- CreateIndex
CREATE UNIQUE INDEX "matchmaking_queue_user_id_key" ON "matchmaking_queue"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_stats_user_id_key" ON "user_stats"("user_id");

-- CreateIndex
CREATE INDEX "user_achievements_user_id_idx" ON "user_achievements"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_achievements_user_id_code_key" ON "user_achievements"("user_id", "code");

-- CreateIndex
CREATE INDEX "reports_reporter_id_idx" ON "reports"("reporter_id");

-- CreateIndex
CREATE INDEX "reports_target_user_id_idx" ON "reports"("target_user_id");

-- CreateIndex
CREATE INDEX "reports_status_idx" ON "reports"("status");

-- CreateIndex
CREATE INDEX "challenges_challenger_id_idx" ON "challenges"("challenger_id");

-- CreateIndex
CREATE INDEX "challenges_target_id_idx" ON "challenges"("target_id");

-- CreateIndex
CREATE INDEX "challenges_status_idx" ON "challenges"("status");

-- CreateIndex
CREATE INDEX "friendships_requester_id_idx" ON "friendships"("requester_id");

-- CreateIndex
CREATE INDEX "friendships_target_id_idx" ON "friendships"("target_id");

-- CreateIndex
CREATE INDEX "friendships_status_idx" ON "friendships"("status");

-- CreateIndex
CREATE UNIQUE INDEX "friendships_requester_id_target_id_key" ON "friendships"("requester_id", "target_id");

-- CreateIndex
CREATE INDEX "ix_notifications_user_unread" ON "notifications"("user_id", "read_at", "created_at");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- CreateIndex
CREATE INDEX "ix_user_blocks_blocked_id" ON "user_blocks"("blocked_id");

-- CreateIndex
CREATE INDEX "ix_audit_events_kind_created" ON "audit_events"("kind", "created_at");

-- CreateIndex
CREATE INDEX "ix_audit_events_actor_created" ON "audit_events"("actor_id", "created_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debates" ADD CONSTRAINT "debates_player1_id_fkey" FOREIGN KEY ("player1_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debates" ADD CONSTRAINT "debates_player2_id_fkey" FOREIGN KEY ("player2_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debates" ADD CONSTRAINT "debates_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debates" ADD CONSTRAINT "debates_current_turn_user_id_fkey" FOREIGN KEY ("current_turn_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debate_messages" ADD CONSTRAINT "debate_messages_debate_id_fkey" FOREIGN KEY ("debate_id") REFERENCES "debates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debate_messages" ADD CONSTRAINT "debate_messages_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debate_votes" ADD CONSTRAINT "debate_votes_debate_id_fkey" FOREIGN KEY ("debate_id") REFERENCES "debates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debate_votes" ADD CONSTRAINT "debate_votes_voter_id_fkey" FOREIGN KEY ("voter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debate_votes" ADD CONSTRAINT "debate_votes_vote_for_fkey" FOREIGN KEY ("vote_for") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debate_results" ADD CONSTRAINT "debate_results_debate_id_fkey" FOREIGN KEY ("debate_id") REFERENCES "debates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debate_results" ADD CONSTRAINT "debate_results_winner_id_fkey" FOREIGN KEY ("winner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debate_results" ADD CONSTRAINT "debate_results_loser_id_fkey" FOREIGN KEY ("loser_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matchmaking_queue" ADD CONSTRAINT "matchmaking_queue_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_stats" ADD CONSTRAINT "user_stats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_code_fkey" FOREIGN KEY ("code") REFERENCES "achievements"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_debate_id_fkey" FOREIGN KEY ("debate_id") REFERENCES "debates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "debate_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_challenger_id_fkey" FOREIGN KEY ("challenger_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_debate_id_fkey" FOREIGN KEY ("debate_id") REFERENCES "debates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocker_id_fkey" FOREIGN KEY ("blocker_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_blocks" ADD CONSTRAINT "user_blocks_blocked_id_fkey" FOREIGN KEY ("blocked_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
