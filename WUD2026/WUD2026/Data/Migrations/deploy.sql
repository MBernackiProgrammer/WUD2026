CREATE TABLE IF NOT EXISTS "__EFMigrationsHistory" (
    "MigrationId" character varying(150) NOT NULL,
    "ProductVersion" character varying(32) NOT NULL,
    CONSTRAINT "PK___EFMigrationsHistory" PRIMARY KEY ("MigrationId")
);

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261017200724_InitialContentSchema') THEN
    CREATE TABLE "ContentRevisions" (
        "Revision" bigint NOT NULL,
        "CreatedAt" timestamp with time zone NOT NULL,
        "Operation" character varying(80) NOT NULL,
        "Snapshot" jsonb NOT NULL,
        CONSTRAINT "PK_ContentRevisions" PRIMARY KEY ("Revision")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261017200724_InitialContentSchema') THEN
    CREATE TABLE "Events" (
        "Id" character varying(100) NOT NULL,
        "Title" character varying(150) NOT NULL,
        "Subtitle" character varying(250) NOT NULL,
        "Category" character varying(80) NOT NULL,
        "Date" date NOT NULL,
        "Time" time without time zone NOT NULL,
        "Duration" integer NOT NULL,
        "Room" character varying(150) NOT NULL,
        "Price" numeric(10,2) NOT NULL,
        "Image" character varying(200) NOT NULL,
        "Mood" character varying(80) NOT NULL,
        "Audience" character varying(80) NOT NULL,
        "Age" integer NOT NULL,
        "Description" character varying(5000) NOT NULL,
        "Program" text[] NOT NULL,
        "Artists" character varying(500) NOT NULL,
        "Status" character varying(16) NOT NULL,
        "PublicationState" character varying(16) NOT NULL,
        "PublishAt" timestamp with time zone,
        CONSTRAINT "PK_Events" PRIMARY KEY ("Id"),
        CONSTRAINT "CK_Events_Age" CHECK ("Age" BETWEEN 0 AND 120),
        CONSTRAINT "CK_Events_Duration" CHECK ("Duration" BETWEEN 5 AND 1440),
        CONSTRAINT "CK_Events_Price" CHECK ("Price" >= 0 AND "Price" <= 10000),
        CONSTRAINT "CK_Events_PublicationState" CHECK ("PublicationState" IN ('draft','published','scheduled')),
        CONSTRAINT "CK_Events_Schedule" CHECK ("PublicationState" <> 'scheduled' OR "PublishAt" IS NOT NULL),
        CONSTRAINT "CK_Events_Status" CHECK ("Status" IN ('available','sold-out','unknown'))
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261017200724_InitialContentSchema') THEN
    CREATE TABLE "SiteState" (
        "Id" integer NOT NULL,
        "Revision" bigint NOT NULL,
        "UpdatedAt" timestamp with time zone NOT NULL,
        "HeroPublishAt" timestamp with time zone,
        CONSTRAINT "PK_SiteState" PRIMARY KEY ("Id"),
        CONSTRAINT "CK_SiteState_Revision" CHECK ("Revision" > 0),
        CONSTRAINT "CK_SiteState_Singleton" CHECK ("Id" = 1)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261017200724_InitialContentSchema') THEN
    CREATE TABLE "HeroVersions" (
        "Slot" character varying(16) NOT NULL,
        "Eyebrow" character varying(120) NOT NULL,
        "Title" character varying(100) NOT NULL,
        "HighlightedTitle" character varying(100) NOT NULL,
        "Description" character varying(500) NOT NULL,
        "ImageUrl" character varying(1000) NOT NULL,
        "ImageAlt" character varying(250) NOT NULL,
        "PrimaryLabel" character varying(60) NOT NULL,
        "PrimaryHref" character varying(250) NOT NULL,
        "SecondaryLabel" character varying(60) NOT NULL,
        "SecondaryHref" character varying(250) NOT NULL,
        "SideText" character varying(120) NOT NULL,
        "Caption" character varying(120) NOT NULL,
        "FeaturedEventId" character varying(100) NOT NULL,
        "FeaturedLabel" character varying(100) NOT NULL,
        CONSTRAINT "PK_HeroVersions" PRIMARY KEY ("Slot"),
        CONSTRAINT "CK_HeroVersions_Slot" CHECK ("Slot" IN ('draft','published','scheduled')),
        CONSTRAINT "FK_HeroVersions_Events_FeaturedEventId" FOREIGN KEY ("FeaturedEventId") REFERENCES "Events" ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261017200724_InitialContentSchema') THEN
    CREATE INDEX "IX_ContentRevisions_CreatedAt" ON "ContentRevisions" ("CreatedAt");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261017200724_InitialContentSchema') THEN
    CREATE INDEX "IX_Events_Category_Date" ON "Events" ("Category", "Date");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261017200724_InitialContentSchema') THEN
    CREATE INDEX "IX_Events_Date_Time" ON "Events" ("Date", "Time");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261017200724_InitialContentSchema') THEN
    CREATE INDEX "IX_Events_PublicationState_PublishAt" ON "Events" ("PublicationState", "PublishAt");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261017200724_InitialContentSchema') THEN
    CREATE INDEX "IX_HeroVersions_FeaturedEventId" ON "HeroVersions" ("FeaturedEventId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261017200724_InitialContentSchema') THEN
    CREATE INDEX "IX_SiteState_HeroPublishAt" ON "SiteState" ("HeroPublishAt");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261017200724_InitialContentSchema') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20261017200724_InitialContentSchema', '10.0.13');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261017202403_AddEventTicketUrl') THEN
    ALTER TABLE "Events" ADD "TicketUrl" character varying(2048);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261017202403_AddEventTicketUrl') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20261017202403_AddEventTicketUrl', '10.0.13');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261017203514_AddCuratorConversations') THEN
    CREATE TABLE "ChatSessions" (
        "Id" uuid NOT NULL,
        "TokenHash" character varying(64) NOT NULL,
        "Memory" character varying(4000) NOT NULL,
        "Turn" integer NOT NULL,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone NOT NULL,
        "ExpiresAt" timestamp with time zone NOT NULL,
        "LeaseId" uuid,
        "LeaseUntil" timestamp with time zone,
        CONSTRAINT "PK_ChatSessions" PRIMARY KEY ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261017203514_AddCuratorConversations') THEN
    CREATE TABLE "ChatTurns" (
        "SessionId" uuid NOT NULL,
        "RequestId" uuid NOT NULL,
        "Number" integer NOT NULL,
        "Question" character varying(2000) NOT NULL,
        "Reply" character varying(8000) NOT NULL,
        "Recommendations" jsonb NOT NULL,
        "FollowUps" text[] NOT NULL,
        "CatalogRevision" bigint NOT NULL,
        "CreatedAt" timestamp with time zone NOT NULL,
        CONSTRAINT "PK_ChatTurns" PRIMARY KEY ("SessionId", "RequestId"),
        CONSTRAINT "FK_ChatTurns_ChatSessions_SessionId" FOREIGN KEY ("SessionId") REFERENCES "ChatSessions" ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261017203514_AddCuratorConversations') THEN
    CREATE INDEX "IX_ChatSessions_ExpiresAt" ON "ChatSessions" ("ExpiresAt");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261017203514_AddCuratorConversations') THEN
    CREATE UNIQUE INDEX "IX_ChatTurns_SessionId_Number" ON "ChatTurns" ("SessionId", "Number");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261017203514_AddCuratorConversations') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20261017203514_AddCuratorConversations', '10.0.13');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261017205846_AddOfficialRepertoireMetadata') THEN
    ALTER TABLE "Events" ALTER COLUMN "Price" DROP NOT NULL;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261017205846_AddOfficialRepertoireMetadata') THEN
    ALTER TABLE "Events" ALTER COLUMN "Duration" DROP NOT NULL;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261017205846_AddOfficialRepertoireMetadata') THEN
    ALTER TABLE "Events" ADD "SourceUrl" character varying(2048);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261017205846_AddOfficialRepertoireMetadata') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20261017205846_AddOfficialRepertoireMetadata', '10.0.13');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261017210147_ExpandOfficialArtists') THEN
    ALTER TABLE "Events" ALTER COLUMN "Artists" TYPE character varying(2000);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261017210147_ExpandOfficialArtists') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20261017210147_ExpandOfficialArtists', '10.0.13');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261017212543_AddCatalogTags') THEN
    ALTER TABLE "Events" ADD "Tags" text[] NOT NULL DEFAULT ARRAY[]::text[];
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261017212543_AddCatalogTags') THEN
    UPDATE "Events" SET "Tags" = ARRAY[
        CASE
            WHEN "Subtitle" ILIKE 'Warsztat%' OR "Category" IN ('Zwiedzanie', 'Wystawy') THEN 'events'
            WHEN "Category" IN ('Symfoniczne', 'Kameralne', 'Jazz', 'Filmowe', 'Recitale', 'Muzyka świata', 'Koncerty zewnętrzne', 'Dla rodzin') THEN 'repertoire'
            WHEN "Subtitle" ILIKE 'Koncert%' OR "Subtitle" ILIKE 'Recital%' OR "Subtitle" ILIKE 'Spektakl muzyczny%' THEN 'repertoire'
            ELSE 'events'
        END
    ]::text[];
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261017212543_AddCatalogTags') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20261017212543_AddCatalogTags', '10.0.13');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261017230155_AddIdentityAccounts') THEN
    CREATE TABLE "AspNetRoles" (
        "Id" text NOT NULL,
        "Name" character varying(256),
        "NormalizedName" character varying(256),
        "ConcurrencyStamp" text,
        CONSTRAINT "PK_AspNetRoles" PRIMARY KEY ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261017230155_AddIdentityAccounts') THEN
    CREATE TABLE "AspNetUsers" (
        "Id" text NOT NULL,
        "DisplayName" character varying(100) NOT NULL,
        "SchoolName" character varying(200) NOT NULL,
        "SchoolAddress" character varying(300) NOT NULL,
        "FavoriteEventIds" text[] NOT NULL,
        "CreatedAt" timestamp with time zone NOT NULL,
        "UserName" character varying(256),
        "NormalizedUserName" character varying(256),
        "Email" character varying(256),
        "NormalizedEmail" character varying(256),
        "EmailConfirmed" boolean NOT NULL,
        "PasswordHash" text,
        "SecurityStamp" text,
        "ConcurrencyStamp" text,
        "PhoneNumber" text,
        "PhoneNumberConfirmed" boolean NOT NULL,
        "TwoFactorEnabled" boolean NOT NULL,
        "LockoutEnd" timestamp with time zone,
        "LockoutEnabled" boolean NOT NULL,
        "AccessFailedCount" integer NOT NULL,
        CONSTRAINT "PK_AspNetUsers" PRIMARY KEY ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261017230155_AddIdentityAccounts') THEN
    CREATE TABLE "AspNetRoleClaims" (
        "Id" integer GENERATED BY DEFAULT AS IDENTITY,
        "RoleId" text NOT NULL,
        "ClaimType" text,
        "ClaimValue" text,
        CONSTRAINT "PK_AspNetRoleClaims" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_AspNetRoleClaims_AspNetRoles_RoleId" FOREIGN KEY ("RoleId") REFERENCES "AspNetRoles" ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261017230155_AddIdentityAccounts') THEN
    CREATE TABLE "AspNetUserClaims" (
        "Id" integer GENERATED BY DEFAULT AS IDENTITY,
        "UserId" text NOT NULL,
        "ClaimType" text,
        "ClaimValue" text,
        CONSTRAINT "PK_AspNetUserClaims" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_AspNetUserClaims_AspNetUsers_UserId" FOREIGN KEY ("UserId") REFERENCES "AspNetUsers" ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261017230155_AddIdentityAccounts') THEN
    CREATE TABLE "AspNetUserLogins" (
        "LoginProvider" text NOT NULL,
        "ProviderKey" text NOT NULL,
        "ProviderDisplayName" text,
        "UserId" text NOT NULL,
        CONSTRAINT "PK_AspNetUserLogins" PRIMARY KEY ("LoginProvider", "ProviderKey"),
        CONSTRAINT "FK_AspNetUserLogins_AspNetUsers_UserId" FOREIGN KEY ("UserId") REFERENCES "AspNetUsers" ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261017230155_AddIdentityAccounts') THEN
    CREATE TABLE "AspNetUserRoles" (
        "UserId" text NOT NULL,
        "RoleId" text NOT NULL,
        CONSTRAINT "PK_AspNetUserRoles" PRIMARY KEY ("UserId", "RoleId"),
        CONSTRAINT "FK_AspNetUserRoles_AspNetRoles_RoleId" FOREIGN KEY ("RoleId") REFERENCES "AspNetRoles" ("Id") ON DELETE CASCADE,
        CONSTRAINT "FK_AspNetUserRoles_AspNetUsers_UserId" FOREIGN KEY ("UserId") REFERENCES "AspNetUsers" ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261017230155_AddIdentityAccounts') THEN
    CREATE TABLE "AspNetUserTokens" (
        "UserId" text NOT NULL,
        "LoginProvider" text NOT NULL,
        "Name" text NOT NULL,
        "Value" text,
        CONSTRAINT "PK_AspNetUserTokens" PRIMARY KEY ("UserId", "LoginProvider", "Name"),
        CONSTRAINT "FK_AspNetUserTokens_AspNetUsers_UserId" FOREIGN KEY ("UserId") REFERENCES "AspNetUsers" ("Id") ON DELETE CASCADE
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261017230155_AddIdentityAccounts') THEN
    CREATE INDEX "IX_AspNetRoleClaims_RoleId" ON "AspNetRoleClaims" ("RoleId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261017230155_AddIdentityAccounts') THEN
    CREATE UNIQUE INDEX "RoleNameIndex" ON "AspNetRoles" ("NormalizedName");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261017230155_AddIdentityAccounts') THEN
    CREATE INDEX "IX_AspNetUserClaims_UserId" ON "AspNetUserClaims" ("UserId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261017230155_AddIdentityAccounts') THEN
    CREATE INDEX "IX_AspNetUserLogins_UserId" ON "AspNetUserLogins" ("UserId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261017230155_AddIdentityAccounts') THEN
    CREATE INDEX "IX_AspNetUserRoles_RoleId" ON "AspNetUserRoles" ("RoleId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261017230155_AddIdentityAccounts') THEN
    CREATE INDEX "EmailIndex" ON "AspNetUsers" ("NormalizedEmail");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261017230155_AddIdentityAccounts') THEN
    CREATE UNIQUE INDEX "UserNameIndex" ON "AspNetUsers" ("NormalizedUserName");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261017230155_AddIdentityAccounts') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20261017230155_AddIdentityAccounts', '10.0.13');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261018000008_AddEventDetails') THEN
    ALTER TABLE "Events" DROP CONSTRAINT "CK_Events_Status";
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261018000008_AddEventDetails') THEN
    ALTER TABLE "Events" ADD "Details" jsonb NOT NULL DEFAULT '{}';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261018000008_AddEventDetails') THEN
    ALTER TABLE "Events" ADD CONSTRAINT "CK_Events_Status" CHECK ("Status" IN ('available','last-tickets','sold-out','unknown'));
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20261018000008_AddEventDetails') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20261018000008_AddEventDetails', '10.0.13');
    END IF;
END $EF$;
COMMIT;

