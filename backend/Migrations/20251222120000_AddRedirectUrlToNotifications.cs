using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PreClear.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddRedirectUrlToNotifications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "redirect_url",
                table: "notifications",
                type: "varchar(500)",
                maxLength: 500,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            // Update existing notifications to have redirect URLs based on their type and shipment_id
            migrationBuilder.Sql(@"
                UPDATE notifications 
                SET redirect_url = CONCAT('/shipments/', shipment_id, '/chat')
                WHERE type IN ('chat_message', 'new_message') AND shipment_id IS NOT NULL;
                
                UPDATE notifications 
                SET redirect_url = CONCAT('/shipments/', shipment_id, '/documents')
                WHERE type IN ('document_request', 'documents-requested') AND shipment_id IS NOT NULL;
                
                UPDATE notifications 
                SET redirect_url = CONCAT('/shipments/', shipment_id)
                WHERE redirect_url IS NULL AND shipment_id IS NOT NULL;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "redirect_url",
                table: "notifications");
        }
    }
}
