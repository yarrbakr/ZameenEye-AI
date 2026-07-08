import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm"

// Export the matching type for your logic gates
export type AlertLevel = "LOW" | "MEDIUM" | "HIGH"

@Entity()
export class DisasterEvent {
    @PrimaryGeneratedColumn("uuid")
    id!: string

    @Column({ type: "enum", enum: ["nasa_firms", "unosat", "copernicus"] })
    source!: "nasa_firms" | "unosat" | "copernicus"

    @Column({
        type: "geometry",
        spatialFeatureType: "Point",
        srid: 4326,
    })
    geom!: string

    @Column({ type: "jsonb" })
    raw_payload!: object

    // : Severity Classification column
    @Column({
        type: "enum",
        enum: ["LOW", "MEDIUM", "HIGH"],
        default: "LOW",
        name: "alert_level"
    })
    alert_level!: AlertLevel

    @Column({ type: "timestamp" })
    detected_at!: Date

    @CreateDateColumn()
    created_at!: Date
}