import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAlertLevelToDisasterEvent1719900000000 implements MigrationInterface {
    name = 'AddAlertLevelToDisasterEvent1719900000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Create the custom PostgreSQL enum type safely
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "public"."disaster_event_alert_level_enum" AS ENUM('LOW', 'MEDIUM', 'HIGH');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);

        // 2. Add the column targeting your exact table name layout
        await queryRunner.query(`
            ALTER TABLE "disaster_event" 
            ADD COLUMN "alert_level" "public"."disaster_event_alert_level_enum" 
            NOT NULL DEFAULT 'LOW';
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop column first
        await queryRunner.query(`ALTER TABLE "disaster_event" DROP COLUMN "alert_level";`);
        
        // Drop custom enum type
        await queryRunner.query(`DROP TYPE "public"."disaster_event_alert_level_enum";`);
    }
}