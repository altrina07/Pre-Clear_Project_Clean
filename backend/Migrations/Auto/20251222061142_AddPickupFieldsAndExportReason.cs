using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations.Auto
{
    /// <inheritdoc />
    public partial class AddPickupFieldsAndExportReason : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "estimated_dropoff_date",
                table: "shipments",
                type: "datetime(3)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "pickup_date",
                table: "shipments",
                type: "datetime(3)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "pickup_location",
                table: "shipments",
                type: "varchar(500)",
                maxLength: 500,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "pickup_time_earliest",
                table: "shipments",
                type: "varchar(10)",
                maxLength: 10,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "pickup_time_latest",
                table: "shipments",
                type: "varchar(10)",
                maxLength: 10,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "pickup_type",
                table: "shipments",
                type: "varchar(50)",
                maxLength: 50,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "estimated_dropoff_date",
                table: "shipments");

            migrationBuilder.DropColumn(
                name: "pickup_date",
                table: "shipments");

            migrationBuilder.DropColumn(
                name: "pickup_location",
                table: "shipments");

            migrationBuilder.DropColumn(
                name: "pickup_time_earliest",
                table: "shipments");

            migrationBuilder.DropColumn(
                name: "pickup_time_latest",
                table: "shipments");

            migrationBuilder.DropColumn(
                name: "pickup_type",
                table: "shipments");
        }
    }
}
