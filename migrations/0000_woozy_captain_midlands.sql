CREATE TABLE "cost_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"wbs_item_id" integer NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"description" text,
	"entry_date" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dependencies" (
	"id" serial PRIMARY KEY NOT NULL,
	"predecessor_id" integer NOT NULL,
	"successor_id" integer NOT NULL,
	"type" text NOT NULL,
	"lag" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"budget" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wbs_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"parent_id" integer,
	"name" text NOT NULL,
	"description" text,
	"level" integer NOT NULL,
	"code" text NOT NULL,
	"type" text NOT NULL,
	"budgeted_cost" numeric(12, 2) NOT NULL,
	"actual_cost" numeric(12, 2) DEFAULT '0',
	"percent_complete" numeric(5, 2) DEFAULT '0',
	"start_date" date,
	"end_date" date,
	"duration" integer,
	"actual_start_date" date,
	"actual_end_date" date,
	"is_top_level" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cost_entries" ADD CONSTRAINT "cost_entries_wbs_item_id_wbs_items_id_fk" FOREIGN KEY ("wbs_item_id") REFERENCES "public"."wbs_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dependencies" ADD CONSTRAINT "dependencies_predecessor_id_wbs_items_id_fk" FOREIGN KEY ("predecessor_id") REFERENCES "public"."wbs_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dependencies" ADD CONSTRAINT "dependencies_successor_id_wbs_items_id_fk" FOREIGN KEY ("successor_id") REFERENCES "public"."wbs_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wbs_items" ADD CONSTRAINT "wbs_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;