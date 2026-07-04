import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm"

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

    @Column({ type: "timestamp" })
    detected_at!: Date

    @CreateDateColumn()
    created_at!: Date
}