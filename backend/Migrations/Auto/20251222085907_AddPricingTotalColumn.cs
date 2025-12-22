using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations.Auto
{
    /// <inheritdoc />
    public partial class AddPricingTotalColumn : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "pricing_total",
                table: "shipments",
                type: "decimal(65,30)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "pricing_total",
                table: "shipments");
        }
    }
}
