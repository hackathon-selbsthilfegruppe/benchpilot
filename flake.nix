{
  description = "BenchPilot hackathon dev shell";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs_20
            git
            jq
            ripgrep
            fd
            tmux
            python3
            pkg-config
          ];

          shellHook = ''
            echo "BenchPilot dev shell"
            echo "  npm install"
            echo "  npm run dev"
            echo "  npm run typecheck"
          '';
        };

        formatter = pkgs.nixfmt-rfc-style;
      });
}
